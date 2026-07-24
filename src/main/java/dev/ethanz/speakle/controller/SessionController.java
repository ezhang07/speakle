package dev.ethanz.speakle.controller;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import dev.ethanz.speakle.entity.Session;
import dev.ethanz.speakle.model.AuthResponse;
import dev.ethanz.speakle.model.TranscribeResponse;
import dev.ethanz.speakle.repository.SessionRepository;
import dev.ethanz.speakle.service.JwtService;
import dev.ethanz.speakle.service.TranscriptionService;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final TranscriptionService transcriptionService;
    private final SessionRepository sessionRepository;
    private final JwtService jwtService;

    public SessionController(TranscriptionService transcriptionService, SessionRepository sessionRepository, JwtService jwtService) {
        this.transcriptionService = transcriptionService;
        this.sessionRepository = sessionRepository;
        this.jwtService = jwtService;
    }

    // Transcription controller, takes a recording, returns transcript + computed metrics as JSON
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TranscribeResponse transcribe(@RequestParam("file") MultipartFile file,
                             @RequestParam("promptText") String promptText,
                             @RequestParam("promptCategory") String promptCategory, @AuthenticationPrincipal String userId) {
        return transcriptionService.process(file, promptText, promptCategory, userId);
    }

    @GetMapping
    public List<Session> getSessions(@AuthenticationPrincipal String userId) {
        return sessionRepository.findByUserId(userId);
    }

    @GetMapping("/{id}/video")
    public ResponseEntity<Resource> getVideo(@PathVariable String id, @RequestParam("token") String videoToken) {
        String sessionId = null;

        try {
            sessionId = jwtService.extractUserId(videoToken);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (!sessionId.equals(id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Path videoPath = Path.of("./recordings", id + ".webm");
        Resource video = new FileSystemResource(videoPath);

        if (!video.exists()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok().contentType(MediaType.parseMediaType("video/webm")).body(video);
    }

    @GetMapping("/{id}/video-token")
    public ResponseEntity<?> getVideoToken(@PathVariable String id, @AuthenticationPrincipal String userId) {
        Optional<Session> session = sessionRepository.findById(id);
        
        if (session.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (!userId.equals(session.get().getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String videoToken = jwtService.generateVideoToken(id);

        return ResponseEntity.ok(new AuthResponse(videoToken));
    }
}