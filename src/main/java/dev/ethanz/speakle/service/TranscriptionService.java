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
import dev.ethanz.speakle.entity.Session;
import dev.ethanz.speakle.model.AiFeedback;
import dev.ethanz.speakle.model.Metrics;
import dev.ethanz.speakle.model.TranscribeResponse;
import dev.ethanz.speakle.repository.SessionRepository;

@Service
public class TranscriptionService {

    private final SessionRepository repository;
    private final String ffmpegPath;
    private final RestClient whisperClient;
    private final MetricsService metricsService;
    private final AiFeedbackService aiFeedback;
    private final ObjectMapper objectMapper;
    private final S3Service s3Service;

    public TranscriptionService(
            @Value("${ffmpeg.path:ffmpeg}") String ffmpegPath,
            @Value("${whisper.service.url:http://localhost:8000}") String whisperServiceUrl,
            SessionRepository sessionRepository, MetricsService metricsService, ObjectMapper objectMapper, AiFeedbackService aiFeedback, S3Service s3Service) {
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
        this.metricsService = metricsService;
        this.aiFeedback = aiFeedback;
        this.objectMapper = objectMapper;
    }

    
    // Full pipeline: persist upload, extract audio, transcribe, compute metrics.
    public TranscribeResponse process(MultipartFile file, String promptText, String promptCategory, String userId) throws IOException {
        String id = UUID.randomUUID().toString();
        Path audio = null;
        Path video = null;
        try {
            // make temp files for video and audio
            audio = Files.createTempFile(id, ".mp3");
            video = Files.createTempFile(id, ".webm");
            Files.copy(file.getInputStream(), video, StandardCopyOption.REPLACE_EXISTING);

            // upload video to s3, then in finally, the video will be deleted from local temp storage
            s3Service.putObject(video, id);

            // get audio from video, then give this new audio path to transcribe to get transcript, finally throws away temp file
            extractAudio(audio, video);
            String transcript = transcribe(audio);
            
            TranscriptDto dto = objectMapper.readValue(transcript, TranscriptDto.class);
            Metrics metrics = metricsService.compute(dto.getWords());

            // LLM feedback is best-effort: if it fails, generate() returns null and we
            // still save the transcript + deterministic metrics.
            AiFeedback feedback = aiFeedback.generate(dto, promptText, metrics);
            String summary = null;
            if (feedback != null) {
                metrics = metrics.withAiMetrics(feedback.bloatRatio(), feedback.timeToFirstPoint());
                summary = feedback.summary();
            }

            Session session = new Session(id, userId, promptText, promptCategory, transcript, metrics, summary);
            repository.save(session);
            return new TranscribeResponse(dto, metrics, summary);
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
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
