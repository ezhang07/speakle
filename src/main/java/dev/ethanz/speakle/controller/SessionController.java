package dev.ethanz.speakle.controller;

import java.nio.file.Path;
import java.util.List;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import dev.ethanz.speakle.entity.Session;
import dev.ethanz.speakle.repository.SessionRepository;
import dev.ethanz.speakle.service.TranscriptionService;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final TranscriptionService transcriptionService;
    private final SessionRepository sessionRepository;

    public SessionController(TranscriptionService transcriptionService, SessionRepository sessionRepository) {
        this.transcriptionService = transcriptionService;
        this.sessionRepository = sessionRepository;
    }

    // Transcription controller, takes a recording, returns JSON transcription
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String transcribe(@RequestParam("file") MultipartFile file, 
                             @RequestParam("promptText") String promptText,
                             @RequestParam("promptCategory") String promptCategory) {
        return transcriptionService.process(file, promptText, promptCategory);
    }

    @GetMapping
    public List<Session> getSessions() {
        return sessionRepository.findAll();
    }

    @GetMapping("/{id}/video")
    public ResponseEntity<Resource> getVideo(@PathVariable String id) {
        Path videoPath = Path.of("./recordings", id + ".webm");
        Resource video = new FileSystemResource(videoPath);

        if (!video.exists()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok().contentType(MediaType.parseMediaType("video/webm")).body(video);
    }

    
}