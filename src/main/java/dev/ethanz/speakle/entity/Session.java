package dev.ethanz.speakle.entity;

import java.time.Instant;

import dev.ethanz.speakle.model.Metrics;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;

@Entity
@Getter
public class Session {
    
    @Id
    private String sessionId;
    private String userId;
    private String promptText;
    private String promptCategory;
    @Column(columnDefinition = "TEXT")
    private String transcript;
    private Instant createdAt;
    private double durationSeconds;
    private double wordsPerMinute;
    private int fillerCount;
    private double fillersPerMinute;
    private double longestPause;
    private double longestPauseTimeStamp;
    private Double bloatRatio;
    private Double timeToFirstPoint;
    @Column(columnDefinition = "TEXT")
    private String summary;


    protected Session() {
    }

    public Session(String sessionId, String userId, String promptText, String promptCategory, String transcript, Metrics metrics, String summary) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.promptText = promptText;
        this.promptCategory = promptCategory;
        this.transcript = transcript;
        this.durationSeconds = metrics.durationSeconds();
        this.wordsPerMinute = metrics.wordsPerMinute();
        this.fillerCount = metrics.fillerCount();
        this.fillersPerMinute = metrics.fillersPerMinute();
        this.longestPause = metrics.longestPause();
        this.longestPauseTimeStamp = metrics.longestPauseTimeStamp();
        this.bloatRatio = metrics.bloatRatio();
        this.timeToFirstPoint = metrics.timeToFirstPoint();
        this.summary = summary;
        this.createdAt = Instant.now();
    }

}