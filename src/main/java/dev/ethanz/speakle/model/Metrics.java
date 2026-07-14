package dev.ethanz.speakle.model;

public record Metrics(
    double durationSeconds,
    double wordsPerMinute,
    int fillerCount,
    double fillersPerMinute,
    double longestPause,
    double longestPauseTimeStamp,
    Double bloatRatio,
    Double timeToFirstPoint
) {
    // Returns a copy with the LLM-derived fields filled in (records are immutable).
    public Metrics withAiMetrics(Double bloatRatio, Double timeToFirstPoint) {
        return new Metrics(durationSeconds, wordsPerMinute, fillerCount,
                fillersPerMinute, longestPause, longestPauseTimeStamp,
                bloatRatio, timeToFirstPoint);
    }
}