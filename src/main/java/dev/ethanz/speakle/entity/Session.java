package dev.ethanz.speakle.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class Session {
    
    @Id
    private String sessionId;
    private String userId;
    @Column(columnDefinition = "TEXT")
    private String transcript;
    private Instant createdAt;

    
    protected Session() {
    }

    public Session(String sessionId, String userId, String transcript) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.transcript = transcript;
        this.createdAt = Instant.now();
    }

}