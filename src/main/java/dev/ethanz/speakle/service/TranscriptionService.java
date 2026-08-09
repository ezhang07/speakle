package dev.ethanz.speakle.service;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.ethanz.speakle.dto.TranscriptDto;
import dev.ethanz.speakle.entity.Job;
import dev.ethanz.speakle.entity.Session;
import dev.ethanz.speakle.model.AiFeedback;
import dev.ethanz.speakle.model.Metrics;
import dev.ethanz.speakle.repository.JobRepository;
import dev.ethanz.speakle.repository.SessionRepository;

@Service
public class TranscriptionService {

    private final SessionRepository repository;
    private final JobRepository jobRepository;
    private final String ffmpegPath;
    private final RestClient whisperClient;
    private final MetricsService metricsService;
    private final AiFeedbackService aiFeedback;
    private final ObjectMapper objectMapper;
    private final S3Service s3Service;

    public TranscriptionService(
            @Value("${ffmpeg.path:ffmpeg}") String ffmpegPath,
            @Value("${whisper.service.url:http://localhost:8000}") String whisperServiceUrl,
            SessionRepository sessionRepository, JobRepository jobRepository, MetricsService metricsService, ObjectMapper objectMapper, AiFeedbackService aiFeedback, S3Service s3Service) {
        this.ffmpegPath = ffmpegPath;
        this.s3Service = s3Service;
        HttpClient jdkClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(jdkClient);
        factory.setReadTimeout(Duration.ofMinutes(5)); // transcription is slow; bound it like the old subprocess
        this.whisperClient = RestClient.builder()
                .baseUrl(whisperServiceUrl)
                .requestFactory(factory)
                .build();
        this.repository = sessionRepository;
        this.jobRepository = jobRepository;
        this.metricsService = metricsService;
        this.aiFeedback = aiFeedback;
        this.objectMapper = objectMapper;
    }

    
    // Front half (runs inside the request): copy the upload to a temp file, push it to S3,
    // and create a PENDING job. Returns the jobId immediately so the request never blocks on
    // the slow pipeline. The actual work happens in runJob().
    public String process(MultipartFile file, String promptText, String promptCategory, String userId) throws IOException {
        String id = UUID.randomUUID().toString();
        Path video = null;
        try {
            // only the video temp file is needed here — audio extraction happens in the back half
            video = Files.createTempFile(id, ".webm");
            Files.copy(file.getInputStream(), video, StandardCopyOption.REPLACE_EXISTING);

            // upload the video to S3 under {id}.webm; the local temp copy is deleted in finally
            s3Service.putObject(video, id);

            // the video lives in S3 under `id`, so the job's videoKey = id
            Job job = new Job(userId, promptText, promptCategory, id);
            jobRepository.save(job);
            return job.getJobId();
        } finally {
            try {
                if (video != null) {
                    Files.deleteIfExists(video);
                }
            } catch (IOException e) {
                throw new RuntimeException("Failed to delete temporary file: " + e.getMessage(), e);
            }
        }
    }

    // Back half (will run in the background): re-download the video from S3, extract audio,
    // transcribe, compute metrics + feedback, save the Session, and mark the job done or failed.
    public void runJob(String jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new RuntimeException("Job not found: " + jobId));
        job.markProcessing();
        jobRepository.save(job);

        Path video = null;
        Path audio = null;
        try {
            // the request's temp copy is long gone — pull the video back down from S3
            video = s3Service.getObject(job.getVideoKey());
            audio = Files.createTempFile(job.getVideoKey(), ".mp3");

            // get audio from video, then transcribe it
            extractAudio(audio, video);
            String transcript = transcribe(audio);

            TranscriptDto dto = objectMapper.readValue(transcript, TranscriptDto.class);
            Metrics metrics = metricsService.compute(dto.getWords());

            // LLM feedback is best-effort: if it fails, generate() returns null and we
            // still save the transcript + deterministic metrics.
            AiFeedback feedback = aiFeedback.generate(dto, job.getPromptText(), metrics);
            String summary = null;
            if (feedback != null) {
                metrics = metrics.withAiMetrics(feedback.bloatRatio(), feedback.timeToFirstPoint());
                summary = feedback.summary();
            }

            // the Session id reuses the video id (job.getVideoKey()), matching the S3 key
            Session session = new Session(job.getVideoKey(), job.getUserId(), job.getPromptText(),
                    job.getPromptCategory(), transcript, metrics, summary);
            repository.save(session);

            job.markCompleted(session.getSessionId());
            jobRepository.save(job);
        } catch (Exception e) {
            job.markFailed();
            jobRepository.save(job);
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new RuntimeException("Transcription pipeline failed: " + e.getMessage(), e);
        } finally {
            try {
                if (video != null) {
                    Files.deleteIfExists(video);
                }
                if (audio != null) {
                    Files.deleteIfExists(audio);
                }
            } catch (IOException e) {
                throw new RuntimeException("Failed to delete temporary files: " + e.getMessage(), e);
            }
        }
    }

    // strip video and re-encode the audio to mp3 via ffmpeg.
    private void extractAudio(Path audio, Path video) throws IOException, InterruptedException {

        Process process = new ProcessBuilder(
                ffmpegPath,
                "-y",                     
                "-i", video.toString(),
                "-vn",                    // drop the video stream
                "-acodec", "libmp3lame",
                "-q:a", "2",              
                audio.toString())
                .redirectErrorStream(true)
                .start();

        String log = new String(process.getInputStream().readAllBytes());

        if (!process.waitFor(2, TimeUnit.MINUTES)) {
            process.destroyForcibly();
            throw new IOException("ffmpeg timed out");
        }
        if (process.exitValue() != 0) {
            throw new IOException("ffmpeg failed (exit " + process.exitValue() + "):\n" + log);
        }
    }

    // POST the extracted mp3 to the whisper FastAPI service and return its JSON transcript.
    private String transcribe(Path audio) {
        // multipart body; the part name "file" MUST match FastAPI's `file: UploadFile = File(...)`.
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(audio));

        return whisperClient.post()
                .uri("/transcribe")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(String.class);
    }
}
