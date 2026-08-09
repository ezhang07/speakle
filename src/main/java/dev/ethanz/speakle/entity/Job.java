package dev.ethanz.speakle.entity;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import lombok.Getter;


@Entity
@Getter
public class Job {

    @Id
    private String jobId;
    private String userId;
    @Enumerated(EnumType.STRING)
    private JobStatus status;
    private String promptText;
    private String promptCategory;
    private String videoKey;
    private String resultSessionId;
    private Instant createdAt;

    protected Job() {

    }

    public Job(String jobId, String userId, String promptText, String promptCategory, String videoKey) {
        this.jobId = jobId;
        this.userId = userId;
        this.status = JobStatus.PENDING;
        this.promptText = promptText;
        this.promptCategory = promptCategory;
        this.videoKey = videoKey;
        this.createdAt = Instant.now();
    }

    public void markProcessing() {
        this.status = JobStatus.PROCESSING;
    }

    public void markFailed() {
        this.status = JobStatus.FAILED;
    }

    public void markCompleted() {
        this.status = JobStatus.COMPLETED;
    }
}