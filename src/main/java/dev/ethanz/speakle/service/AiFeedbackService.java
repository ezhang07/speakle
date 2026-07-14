package dev.ethanz.speakle.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;

import dev.ethanz.speakle.dto.TranscriptDto;
import dev.ethanz.speakle.dto.WordDto;
import dev.ethanz.speakle.model.AiFeedback;
import dev.ethanz.speakle.model.LlmResponse;
import dev.ethanz.speakle.model.Metrics;

@Service
public class AiFeedbackService {

    private final Client client;
    private final ObjectMapper objectMapper;

    public AiFeedbackService(@Value("${gemini.api.key}") String apiKey, ObjectMapper objectMapper) {
        this.client = Client.builder().apiKey(apiKey).build();
        this.objectMapper = objectMapper;
    }

    public AiFeedback generate(TranscriptDto transcript, String promptText, Metrics metrics) throws JsonProcessingException {
        try {
            // convert transcript to indexed string for LLM input (mainly for the time to first point metric)
            List<WordDto> words = transcript.getWords();
            StringBuilder sb = new StringBuilder();

            for (int i = 0; i < words.size(); i++) {
                sb.append("[").append(i).append("] ").append(words.get(i).getWord()).append(" ");
            }
            String indexed = sb.toString();

            // instructions for LLM, what to return
            String system = """
                    You are a concise speaking coach analyzing a spoken-practice transcript. The transcipt is tokenized; each word is tagged like [12] 
                    with its index. Return ONLY JSON with these keys:
                    - conciseVersion: the tightest faithful restatement of what the speaker was trying to say (no filler, no padding)
                    - firstSubstantiveWordIndex: the integer index tag of the first word where the speaker begins to make a substantive point (no filler, no padding)
                    - summary: 2-3 sentences of qualitative coaching feedback. Never use numbers or scores; focus on delivery and getting to the point, can use metrics as another potential input to reference.
                    """;

            // user prompt (holds actual data)
            String prompt = """
                    Assigned prompt: %s

                    Transcript (word index tags in brackets): %s
                    """.formatted(promptText, indexed);

            // config
            GenerateContentConfig config = GenerateContentConfig.builder()
            .systemInstruction(Content.fromParts(Part.fromText(system)))
            .responseMimeType("application/json")
            .build();

            GenerateContentResponse response = client.models.generateContent("gemini-2.5-flash-lite", prompt, config);

            String json = response.text();
            System.out.println("Gemini raw JSON: " + json);

            LlmResponse llmResponse = objectMapper.readValue(json, LlmResponse.class);

            Double bloatRatio = transcript.getWords().size() / (double) llmResponse.conciseVersion().trim().split("\\s+").length;
            int idx = Math.max(0, Math.min(llmResponse.firstSubstantiveWordIndex(), words.size() - 1));
            Double timeToFirstPoint = transcript.getWords().get(idx).getStart();

            return new AiFeedback(bloatRatio, timeToFirstPoint, llmResponse.summary());
        } catch (Exception e) {
            System.err.println("AI feedback failed: " + e);
            return null;
        }


        
        
        

    }
    

}