package dev.ethanz.speakle.model;

// The presigned S3 URL the frontend drops straight into <video src>.
public record VideoUrlResponse(String url) {}
