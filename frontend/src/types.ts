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

/** The JSON GET /api/sessions/{id}/video-url returns (see model/VideoUrlResponse.java). */
export interface VideoUrlResponse {
  url: string;
}

/** The JSON POST /api/sessions/upload-url returns (see model/UploadUrlResponse.java).
 *  uploadUrl is a short-lived presigned S3 PUT URL; the browser uploads the video straight
 *  to it. videoKey is the id the backend minted — send it back to /transcribe. */
export interface UploadUrlResponse {
  uploadUrl: string;
  videoKey: string;
}

/** The JSON POST /api/sessions/transcribe now returns (see model/JobResponse.java).
 *  Just a handle — the frontend polls the job until it completes. */
export interface JobResponse {
  jobId: string;
}

/** Mirrors the Java JobStatus enum */
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** The JSON GET /api/jobs/{jobId} returns (see model/JobStatusResponse.java).
 *  resultSessionId is null until status === 'COMPLETED', then points at the Session. */
export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  resultSessionId: string | null;
}

