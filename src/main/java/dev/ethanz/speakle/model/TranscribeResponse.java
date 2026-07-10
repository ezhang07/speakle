package dev.ethanz.speakle.model;

import dev.ethanz.speakle.dto.TranscriptDto;

// Response shape for POST /transcribe: the parsed transcript + its computed metrics.
public record TranscribeResponse(TranscriptDto transcript, Metrics metrics) {}
