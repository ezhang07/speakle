package dev.ethanz.speakle.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import dev.ethanz.speakle.service.TranscriptionService;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final TranscriptionService transcriptionService;

    public SessionController(TranscriptionService transcriptionService) {
        this.transcriptionService = transcriptionService;
    }

    // Transcription controller, takes a recording, returns JSON transcription
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String transcribe(@RequestParam("file") MultipartFile file) {
        return transcriptionService.process(file);
    }
}