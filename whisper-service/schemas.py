from pydantic import BaseModel


# One transcribed word with its timestamps
class Word(BaseModel):
    word: str
    start: float
    end: float


# Response of whisper model transcription
class TranscriptResponse(BaseModel):
    text: str
    words: list[Word]
