package dev.ethanz.speakle.model;

import dev.ethanz.speakle.entity.JobStatus;

// Returned by GET /api/jobs/{jobId}: what the frontend polls. resultSessionId is null until job completed
public record JobStatusResponse(String jobId, JobStatus status, String resultSessionId) {
}
