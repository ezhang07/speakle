package dev.ethanz.speakle.entity;

import java.time.Instant;

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

    
    protected Session() {
    }

    public Session(String sessionId, String userId, String promptText, String promptCategory, String transcript) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.promptText = promptText;
        this.promptCategory = promptCategory;
        this.transcript = transcript;
        this.createdAt = Instant.now();
    }

}