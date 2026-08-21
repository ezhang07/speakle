package dev.ethanz.speakle.service;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

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

    
    // Front half (runs inside the request): the browser already PUT the video straight to S3 under
    // `videoKey`, so there are no bytes to handle here — just create a PENDING job and return its id
    // immediately. The actual pipeline (download, transcribe, metrics) happens in runJob().
    public String process(String videoKey, String promptText, String promptCategory, String userId) {
        Job job = new Job(userId, promptText, promptCategory, videoKey);
        jobRepository.save(job);
        return job.getJobId();
    }

    // Back half (will run in the background): re-download the video from S3, extract audio,
    // transcribe, compute metrics + feedback, save the Session, and mark the job done or failed.
    @Async
    public void runJob(String jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new RuntimeException("Job not found: " + jobId));
        job.markProcessing();
        jobRepository.save(job);

        Path video = null;
        Path audio = null;
        try {
            // the request's temp copy is long gone — pull the video back down from S3
            video = s3Service.getObject(S3Service.videoKey(job.getVideoKey()));
            audio = Files.createTempFile(job.getVideoKey(), ".mp3");

            // get audio from video, then transcribe it
            extractAudio(audio, video);
            generateThumbnail(video, job.getVideoKey()); // best-effort; never fails the job
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

    // extracts thumbnail from video, and puts in s3
    private void generateThumbnail(Path video, String id) {
        Path thumb = null;
        try {
            thumb = Files.createTempFile(id, ".jpg");

            Process process = new ProcessBuilder(
                    ffmpegPath,
                    "-y",
                    "-i", video.toString(),
                    // -ss AFTER -i on purpose. Before -i is a fast seek through the container's
                    // index, and MediaRecorder webm has none (the same defect behind
                    // `duration: Infinity`) — it lands on a black frame or fails outright.
                    // After -i decodes and discards, which for one second of video is nothing.
                    "-ss", "1",
                    "-frames:v", "1",
                    "-vf", "scale=320:-2",    // -2 derives height from the aspect ratio, kept even
                    "-q:v", "6",              // JPEG quality, 2 = best .. 31 = worst
                    thumb.toString())
                    .redirectErrorStream(true)
                    .start();

            String log = new String(process.getInputStream().readAllBytes());

            if (!process.waitFor(1, TimeUnit.MINUTES)) {
                process.destroyForcibly();
                throw new IOException("ffmpeg timed out generating a thumbnail");
            }
            if (process.exitValue() != 0) {
                throw new IOException("ffmpeg thumbnail failed (exit " + process.exitValue() + "):\n" + log);
            }
            // A clip shorter than the seek point produces no frames and still exits 0,
            // leaving an empty file — don't upload that.
            if (Files.size(thumb) == 0) {
                throw new IOException("ffmpeg produced an empty thumbnail (clip shorter than the seek point?)");
            }

            s3Service.putObject(thumb, S3Service.thumbKey(id), "image/jpeg");
        } catch (Exception e) {
            System.out.println("Thumbnail generation failed for " + id + ": " + e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        } finally {
            if (thumb != null) {
                try {
                    Files.deleteIfExists(thumb);
                } catch (IOException ignored) {
                    // temp file cleanup is best-effort
                }
            }
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
