package dev.ethanz.speakle.dto;

import java.util.List;

public class TranscriptDto {

    private String text;
    private List<WordDto> words;

    public String getText() {
        return text;
    }

    public List<WordDto> getWords() {
        return words;
    }

    public void setText(String text) {
        this.text = text;
    } 

    public void setWords(List<WordDto> words) {
        this.words = words;
    }

}