package dev.ethanz.speakle.model;

import dev.ethanz.speakle.dto.TranscriptDto;

// Response shape for POST /transcribe: the parsed transcript, its computed metrics,
// and the qualitative AI summary (null if the LLM call failed).
public record TranscribeResponse(TranscriptDto transcript, Metrics metrics, String summary) {}
