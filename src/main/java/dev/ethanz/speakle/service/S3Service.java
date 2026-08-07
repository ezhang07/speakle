package dev.ethanz.speakle.service;

import java.io.IOException;
import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class S3Service {
    private final S3Client s3Client;
    private final String bucket;

    public S3Service(S3Client s3Client, @Value("${aws.s3.bucket}") String bucket) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    // Upload the recording to s3://{bucket}/{id}.webm.
    public void putObject(Path file, String id) throws IOException {
        // The request describes WHERE + WHAT metadata; RequestBody carries the bytes.
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(id + ".webm")
                .contentType("video/webm")
                .build();

        s3Client.putObject(request, RequestBody.fromFile(file));
    }
}
