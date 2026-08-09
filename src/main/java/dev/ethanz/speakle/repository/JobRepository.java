package dev.ethanz.speakle.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import dev.ethanz.speakle.entity.Job;

@Repository
public interface JobRepository extends JpaRepository<Job, String> {
    
}