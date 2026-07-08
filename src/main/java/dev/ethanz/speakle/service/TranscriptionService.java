package dev.ethanz.speakle.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.ethanz.speakle.dto.TranscriptDto;
import dev.ethanz.speakle.entity.Session;
import dev.ethanz.speakle.model.Metrics;
import dev.ethanz.speakle.repository.SessionRepository;

@Service
public class TranscriptionService {

    private static final Path RECORDINGS_DIR = Path.of("./recordings");

    private final SessionRepository repository;
    private final String ffmpegPath;
    private final String pythonPath;
    private final String transcribeScript;
    private final MetricsService metricsService;
    private final ObjectMapper objectMapper;

    public TranscriptionService(
            @Value("${ffmpeg.path:ffmpeg}") String ffmpegPath,
            @Value("${whisper.python:python}") String pythonPath,
            @Value("${whisper.script:scripts/transcribe.py}") String transcribeScript,
            SessionRepository sessionRepository, MetricsService metricsService, ObjectMapper objectMapper) {
        this.ffmpegPath = ffmpegPath;
        this.pythonPath = pythonPath;
        this.transcribeScript = transcribeScript;
        this.repository = sessionRepository;
        this.metricsService = metricsService;
        this.objectMapper = objectMapper;
    }

    
    // Full pipeline: persist upload, extract audio, transcribe.
    public String process(MultipartFile file, String promptText, String promptCategory) {
        try {
            Files.createDirectories(RECORDINGS_DIR);
            String id = UUID.randomUUID().toString();

            Path video = saveUpload(file, id);
            Path audio = extractAudio(video, id);
            String transcript = transcribe(audio);
            
            TranscriptDto dto = objectMapper.readValue(transcript, TranscriptDto.class);
            Metrics metrics = metricsService.compute(dto.getWords());
            
            Session session = new Session(id, null, promptText, promptCategory, transcript, metrics);
            repository.save(session);
            return transcript;
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

    // run local faster-whisper Python transcription script return its JSON stdout.
    private String transcribe(Path audio) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(
                pythonPath,
                transcribeScript,
                audio.toAbsolutePath().toString())
                .redirectError(ProcessBuilder.Redirect.INHERIT)
                .start();

        // stdout carries the result JSON; read it fully before checking the exit code.
        String json = new String(process.getInputStream().readAllBytes()).trim();

        if (!process.waitFor(5, TimeUnit.MINUTES)) {
            process.destroyForcibly();
            throw new IOException("whisper transcription timed out");
        }
        if (process.exitValue() != 0) {
            throw new IOException("whisper transcription failed (exit " + process.exitValue()
                    + ") — check the server console for the Python error");
        }
        return json;
    }
}
