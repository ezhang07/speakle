package dev.ethanz.speakle.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import dev.ethanz.speakle.entity.Session;

@Repository
public interface SessionRepository extends JpaRepository<Session, String> {
    public List<Session> findByUserId(String userId);
}