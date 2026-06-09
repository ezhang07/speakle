package dev.ethanz.speakle;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SpeakleApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpeakleApplication.class, args);
		System.out.println("Application started successfully.");
	}

}
