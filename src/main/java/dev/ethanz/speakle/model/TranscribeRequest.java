package dev.ethanz.speakle.model;

// Body of POST /api/sessions/transcribe. The video is already in S3 (uploaded directly by the
// browser via a presigned URL), so the request only carries the key + prompt metadata — no bytes.
public record TranscribeRequest(String videoKey, String promptText, String promptCategory) {}
