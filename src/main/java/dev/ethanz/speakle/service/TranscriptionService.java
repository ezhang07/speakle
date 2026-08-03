package dev.ethanz.speakle.service;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
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

    private static final Path RECORDINGS_DIR = Path.of("./recordings");

    private final SessionRepository repository;
    private final String ffmpegPath;
    private final RestClient whisperClient;
    private final MetricsService metricsService;
    private final AiFeedbackService aiFeedback;
    private final ObjectMapper objectMapper;

    public TranscriptionService(
            @Value("${ffmpeg.path:ffmpeg}") String ffmpegPath,
            @Value("${whisper.service.url:http://localhost:8000}") String whisperServiceUrl,
            SessionRepository sessionRepository, MetricsService metricsService, ObjectMapper objectMapper, AiFeedbackService aiFeedback) {
        this.ffmpegPath = ffmpegPath;
        // Pin HTTP/1.1: the JDK client defaults to HTTP/2 and tries an h2c upgrade over
        // plaintext, which uvicorn (HTTP/1.1) can't parse
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
    public TranscribeResponse process(MultipartFile file, String promptText, String promptCategory, String userId) {
        try {
            Files.createDirectories(RECORDINGS_DIR);
            String id = UUID.randomUUID().toString();

            Path video = saveUpload(file, id);      
            Path audio = extractAudio(video, id);
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
        }
    }

    // write raw upload to ./recordings/{uuid}.webm.
    private Path saveUpload(MultipartFile file, String id) throws IOException {
        Path target = RECORDINGS_DIR.resolve(id + ".webm");
        file.transferTo(target.toAbsolutePath());
        return target;
    }

    // strip video and re-encode the audio to mp3 via ffmpeg.
    private Path extractAudio(Path video, String id) throws IOException, InterruptedException {
        Path audio = RECORDINGS_DIR.resolve(id + ".mp3");

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
        return audio;
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
