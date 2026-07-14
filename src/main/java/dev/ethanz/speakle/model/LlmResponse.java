package dev.ethanz.speakle.model;

public record LlmResponse(String conciseVersion, int firstSubstantiveWordIndex, String summary) {}