package dev.ethanz.speakle.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

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

    /* ------------------------------------------------------------ keys -- */
    // A session id owns more than one object now (the recording and its poster
    // frame), so the extension can't be baked into the methods below. These two
    // keep the layout in one place instead of scattering string concatenation.

    public static String videoKey(String id) {
        return id + ".webm";
    }

    public static String thumbKey(String id) {
        return id + ".jpg";
    }

    /* --------------------------------------------------------- objects -- */

    // Upload a local file to s3://{bucket}/{key}.
    public void putObject(Path file, String key, String contentType) throws IOException {
        // The request describes WHERE + WHAT metadata; RequestBody carries the bytes.
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        s3Client.putObject(request, RequestBody.fromFile(file));
    }

    // create a presigned URL for when the user wants to watch the video.
    // This is a short-lived URL that allows access to the object without needing AWS credentials.
    public String presignGetUrl(String key) {
        GetObjectRequest getRequest = GetObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
        .signatureDuration(Duration.ofMinutes(10)) // how long URL stays valid
        .getObjectRequest(getRequest)
        .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    // NOTE: deliberately does NOT pin a contentType — the signature would then cover
    // the Content-Type header, and the browser's PUT would have to match it exactly.
    public String presignPutUrl(String key) {
        PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
        .signatureDuration(Duration.ofMinutes(10)) // how long URL stays valid
        .putObjectRequest(putRequest)
        .build();

        return s3Presigner.presignPutObject(presignRequest).url().toString();
    }

    public Path getObject(String key) throws IOException {
        GetObjectRequest request = GetObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .build();

        // Mirror the key's own extension onto the temp file so it's obvious what
        // landed there; ffmpeg sniffs the container itself, so this is cosmetic.
        int dot = key.lastIndexOf('.');
        String prefix = dot < 0 ? key : key.substring(0, dot);
        String suffix = dot < 0 ? "" : key.substring(dot);

        Path tempFile = Files.createTempFile(prefix, suffix);
        // getObject(request, Path) refuses to write to an existing file, but createTempFile
        // already made an empty one — delete it so the SDK can create it itself.
        Files.delete(tempFile);
        s3Client.getObject(request, tempFile);
        return tempFile;
    }

    // Delete one object. Idempotent: deleting a missing key is a no-op success.
    public void deleteObject(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        s3Client.deleteObject(request);
    }
}
