package dev.ethanz.speakle.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.google.genai.Client;

@Service
public class AiFeedbackService {

    private final Client client;

    public AiFeedbackService(@Value("${gemini.api.key}") String apiKey) {
        this.client = Client.builder().apiKey(apiKey).build();
    }

    

}