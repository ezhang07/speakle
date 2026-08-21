package dev.ethanz.speakle.controller;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.ethanz.speakle.entity.Session;
import dev.ethanz.speakle.model.JobResponse;
import dev.ethanz.speakle.model.SessionResponse;
import dev.ethanz.speakle.model.TranscribeRequest;
import dev.ethanz.speakle.model.VideoUrlResponse;
import dev.ethanz.speakle.model.UploadUrlResponse;
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

    // The video is already in S3 (uploaded directly by the browser via a presigned URL). This just
    // creates a PENDING job for that key and kicks off the async pipeline. Returns the jobId fast;
    // the frontend polls GET /jobs/{jobId} until it completes.
    @PostMapping("/transcribe")
    public JobResponse transcribe(@RequestBody TranscribeRequest request,
                             @AuthenticationPrincipal String userId) {
        String jobId = transcriptionService.process(request.videoKey(), request.promptText(),
                request.promptCategory(), userId);
        // runJob is @Async, so this returns immediately (fire-and-forget through the Spring proxy).
        transcriptionService.runJob(jobId);
        return new JobResponse(jobId);
    }

    // Thumb URLs are signed into this response rather than fetched per card: signing is a
    // local HMAC (no S3 call), so one list request replaces N round trips to this server.
    @GetMapping
    public List<SessionResponse> getSessions(@AuthenticationPrincipal String userId) {
        return sessionRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::withThumbUrl)
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getSpecificSession(@PathVariable String id, @AuthenticationPrincipal String userId) {
        Optional<Session> sesh = sessionRepository.findById(id);

        if (sesh.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Session session = sesh.get();

        if (!userId.equals(session.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(withThumbUrl(session));
    }

    private SessionResponse withThumbUrl(Session session) {
        return SessionResponse.of(session, s3Service.presignGetUrl(S3Service.thumbKey(session.getSessionId())));
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

        String presignedURL = s3Service.presignGetUrl(S3Service.videoKey(id));

        return ResponseEntity.ok(new VideoUrlResponse(presignedURL));
    }

    @PostMapping("/upload-url")
    public UploadUrlResponse createUploadUrl(@AuthenticationPrincipal String userId) {
        String id = UUID.randomUUID().toString();
        String url = s3Service.presignPutUrl(S3Service.videoKey(id));
        return new UploadUrlResponse(url, id);
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

        // Objects first, row last: a failure here leaves a visible dangling row rather
        // than invisible orphaned objects. Both objects go, or the jpg outlives the session.
        s3Service.deleteObject(S3Service.videoKey(id));
        s3Service.deleteObject(S3Service.thumbKey(id));
        sessionRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }
}
