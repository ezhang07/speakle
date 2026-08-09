package dev.ethanz.speakle.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import dev.ethanz.speakle.entity.Job;

public interface JobRepository extends JpaRepository<Job, String> {
    
}