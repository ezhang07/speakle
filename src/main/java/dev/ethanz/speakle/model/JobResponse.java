package dev.ethanz.speakle.model;

// Returned by POST /transcribe: the handle the frontend polls until the job completes.
public record JobResponse(String jobId) {
}
