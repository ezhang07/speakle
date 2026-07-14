package dev.ethanz.speakle.model;

public record Metrics(
    double durationSeconds,
    double wordsPerMinute,
    int fillerCount,
    double fillersPerMinute,
    double longestPause,
    double longestPauseTimeStamp,
    Double bloatRatio,
    Double firstRelevantPoint
) {}