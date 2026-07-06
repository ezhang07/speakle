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
 *  `transcript` is a JSON string that parses into a TranscriptData. */
export interface Session {
  sessionId: string;
  userId: string | null;
  promptText: string;
  promptCategory: 'casual' | 'behavioural';
  transcript: string;
  createdAt: string;
}

export interface Prompt {
  text: string;
  category: 'casual' | 'behavioural';
}


