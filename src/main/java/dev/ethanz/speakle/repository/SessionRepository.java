package dev.ethanz.speakle.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import dev.ethanz.speakle.entity.Session;

@Repository
public interface SessionRepository extends JpaRepository<Session, String> {
    // Newest first — Spring Data derives the ORDER BY from the method name.
    // Without it Postgres returns rows in arbitrary order.
    public List<Session> findByUserIdOrderByCreatedAtDesc(String userId);
}