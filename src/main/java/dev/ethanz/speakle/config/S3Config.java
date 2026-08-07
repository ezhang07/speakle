package dev.ethanz.speakle.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;


// Builds the AWS S3 clients once, as singletons, for the whole app.
@Configuration
public class S3Config {

    @Value("${aws.region}")
    private String region;

    // Used for the actual object operations: putObject / getObject / deleteObject.
    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region))
                .build();
    }

    // Used only to mint short-lived, signed playback URLs.
    @Bean
    public S3Presigner s3Presigner() {
        return S3Presigner.builder()
                .region(Region.of(region))
                .build();
    }
}
