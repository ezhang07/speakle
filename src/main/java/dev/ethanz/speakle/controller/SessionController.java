package dev.ethanz.speakle.controller;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
import dev.ethanz.speakle.model.JobResponse;
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

    // Takes a recording, creates a job, and returns the jobId. The frontend polls the job
    // until it completes.
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public JobResponse transcribe(@RequestParam("file") MultipartFile file,
                             @RequestParam("promptText") String promptText,
                             @RequestParam("promptCategory") String promptCategory, @AuthenticationPrincipal String userId) throws IOException {
        String jobId = transcriptionService.process(file, promptText, promptCategory, userId);
        // TEMP: run the pipeline synchronously for now so a Session still gets saved.
        // Next step makes runJob @Async so this call returns immediately.
        transcriptionService.runJob(jobId);
        return new JobResponse(jobId);
    }

    @GetMapping
    public List<Session> getSessions(@AuthenticationPrincipal String userId) {
        return sessionRepository.findByUserId(userId);
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

        return ResponseEntity.ok(session);
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

    @PostMapping("/upload-url")
    public UploadUrlResponse createUploadUrl(@AuthenticationPrincipal String userId) {
        String id = UUID.randomUUID().toString();
        String url = s3Service.presignPutUrl(id);
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

        s3Service.deleteObject(id);
        sessionRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }
}
