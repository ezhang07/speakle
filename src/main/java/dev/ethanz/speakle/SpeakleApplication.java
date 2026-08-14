package dev.ethanz.speakle;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class SpeakleApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpeakleApplication.class, args);
		System.out.println("Application started successfully."); // using ec2
	}

}
