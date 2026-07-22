// Shared data shapes used across the frontend.
// These describe the JSON the backend / transcription pipeline produces.

/** One word from the transcript, with its timestamps in the recording. */
export interface Word {
  word: string;
  start: number;
  end: number;
}

/** The JSON the Python transcriber prints (see scripts/transcribe.py). */
export interface TranscriptData {
  text: string;
  words: Word[];
}

/** A saved practice session row (see entity/Session.java).
 *  `transcript` is a JSON string that parses into a TranscriptData.
 *  The metric fields are computed at transcribe-time (see MetricsService). */
export interface Session {
  sessionId: string;
  userId: string | null;
  promptText: string;
  promptCategory: 'casual' | 'behavioural';
  transcript: string;
  createdAt: string;
  durationSeconds: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillersPerMinute: number;
  longestPause: number;
  longestPauseTimeStamp: number;
  bloatRatio: number | null;
  timeToFirstPoint: number | null;
  summary: string | null;
}

export interface Prompt {
  text: string;
  category: 'casual' | 'behavioural';
}

/** Computed speaking metrics for a session (see model/Metrics.java). */
export interface Metrics {
  durationSeconds: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillersPerMinute: number;
  longestPause: number;
  longestPauseTimeStamp: number;
  bloatRatio: number | null;
  timeToFirstPoint: number | null;
}

/** The JSON POST /api/sessions/transcribe returns (see dto/TranscribeResponse.java). */
export interface TranscribeResponse {
  transcript: TranscriptData;
  metrics: Metrics;
  summary: string | null;
}

/** The JSON POST /api/auth/login returns (see model/AuthResponse.java). */
export interface AuthResponse {
  token: string;
}


