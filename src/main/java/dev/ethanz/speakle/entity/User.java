package dev.ethanz.speakle.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "users")
@Getter
public class User {

    @Id
    private String id;
    @Column(unique = true)
    private String email;
    private String passwordHashed;
    private Instant createdAt;
    
    protected User() {
    }

    public User(String id, String email, String passwordHashed) {
        this.id = id;
        this.email = email;
        this.passwordHashed = passwordHashed;
        this.createdAt = Instant.now();
    }

}
