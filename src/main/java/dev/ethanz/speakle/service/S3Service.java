package dev.ethanz.speakle.service;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service
public class S3Service {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucket;

    public S3Service(S3Client s3Client, S3Presigner s3Presigner, @Value("${aws.s3.bucket}") String bucket) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
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

    public String presignGetUrl(String id) {
        GetObjectRequest getRequest = GetObjectRequest.builder()
        .bucket(bucket)
        .key(id + ".webm")
        .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
        .signatureDuration(Duration.ofMinutes(10)) // how long URL stays valid
        .getObjectRequest(getRequest)
        .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }
}
