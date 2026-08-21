package dev.ethanz.speakle.model;

import java.time.Instant;

import dev.ethanz.speakle.entity.Session;

/**
 * What the session endpoints hand back: every stored column plus a freshly
 * signed {@code thumbUrl}.
 *
 * The URL can't live on the entity — presigned URLs expire (10 minutes), so it
 * has to be minted per request. Signing is a local HMAC with no call to S3, so
 * doing it for a whole list costs nothing and saves the browser one round trip
 * per card.
 *
 * The URL is signed without checking that the object exists — a HEAD per session
 * would cost more than it's worth. Sessions recorded before thumbnails existed
 * get a URL that 404s, and the frontend falls back to its placeholder.
 */
public record SessionResponse(
        String sessionId,
        String userId,
        String promptText,
        String promptCategory,
        String transcript,
        Instant createdAt,
        double durationSeconds,
        double wordsPerMinute,
        int fillerCount,
        double fillersPerMinute,
        double longestPause,
        double longestPauseTimeStamp,
        Double bloatRatio,
        Double timeToFirstPoint,
        String summary,
        String thumbUrl) {

    public static SessionResponse of(Session session, String thumbUrl) {
        return new SessionResponse(
                session.getSessionId(),
                session.getUserId(),
                session.getPromptText(),
                session.getPromptCategory(),
                session.getTranscript(),
                session.getCreatedAt(),
                session.getDurationSeconds(),
                session.getWordsPerMinute(),
                session.getFillerCount(),
                session.getFillersPerMinute(),
                session.getLongestPause(),
                session.getLongestPauseTimeStamp(),
                session.getBloatRatio(),
                session.getTimeToFirstPoint(),
                session.getSummary(),
                thumbUrl);
    }
}
