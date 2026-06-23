package dev.ethanz.speakle.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import dev.ethanz.speakle.entity.Session;

@Repository
public interface SessionRepository extends JpaRepository<Session, String> {
    
}