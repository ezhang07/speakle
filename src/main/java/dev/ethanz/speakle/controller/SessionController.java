package dev.ethanz.speakle.controller;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import dev.ethanz.speakle.entity.Session;
import dev.ethanz.speakle.model.TranscribeResponse;
import dev.ethanz.speakle.model.VideoUrlResponse;
import dev.ethanz.speakle.repository.SessionRepository;
import dev.ethanz.speakle.service.S3Service;
import dev.ethanz.speakle.service.TranscriptionService;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final TranscriptionService transcriptionService;
    private final SessionRepository sessionRepository;
    private final S3Service s3Service;

    public SessionController(TranscriptionService transcriptionService, SessionRepository sessionRepository, S3Service s3Service) {
        this.transcriptionService = transcriptionService;
        this.sessionRepository = sessionRepository;
        this.s3Service = s3Service;
    }

    // Transcription controller, takes a recording, returns transcript + computed metrics as JSON
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TranscribeResponse transcribe(@RequestParam("file") MultipartFile file,
                             @RequestParam("promptText") String promptText,
                             @RequestParam("promptCategory") String promptCategory, @AuthenticationPrincipal String userId) throws IOException {
        return transcriptionService.process(file, promptText, promptCategory, userId);
    }

    @GetMapping
    public List<Session> getSessions(@AuthenticationPrincipal String userId) {
        return sessionRepository.findByUserId(userId);
    }

    @GetMapping("/{id}/video-url")
    public ResponseEntity<?> getVideoURL(@PathVariable String id, @AuthenticationPrincipal String userId) {
        Optional<Session> session = sessionRepository.findById(id);
        
        if (session.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (!userId.equals(session.get().getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String presignedURL = s3Service.presignGetUrl(id);

        return ResponseEntity.ok(new VideoUrlResponse(presignedURL));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSession(@PathVariable String id, @AuthenticationPrincipal String userId) {
        Optional<Session> session = sessionRepository.findById(id);

        if (session.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (!userId.equals(session.get().getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        s3Service.deleteObject(id);
        sessionRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }
}
