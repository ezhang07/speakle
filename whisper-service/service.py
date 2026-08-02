from faster_whisper import WhisperModel

from schemas import TranscriptResponse, Word

# give model context on common filler words so they don't get filtered out
FILLER_PROMPT = (
    "Um, uh, like, you know, I mean, well, so, actually, basically, literally, "
    "right, okay, alright, I guess, I think, I feel like"
)

# Load the model ONCE at import time and reuse it across every request
model = WhisperModel("base", device="cpu", compute_type="int8")


# Transcribe the audio file at `audio_path` and return the { text, words[] }
# result. Pure business logic — no HTTP, no temp-file handling (the caller owns
# the file's lifecycle).
def run_transcription(audio_path: str) -> TranscriptResponse:
    segments, _info = model.transcribe(
        audio_path,
        word_timestamps=True,
        initial_prompt=FILLER_PROMPT,
    )

    # build full text + a flat list of words with timestamps
    words: list[Word] = []
    full_text: list[str] = []
    for segment in segments:
        full_text.append(segment.text)
        for w in segment.words:
            words.append(
                Word(
                    word=w.word,
                    start=round(w.start, 2),
                    end=round(w.end, 2),
                )
            )

    return TranscriptResponse(
        text="".join(full_text).strip(),
        words=words,
    )
