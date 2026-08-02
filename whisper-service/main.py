import os
import tempfile

from fastapi import FastAPI, UploadFile, File

from schemas import TranscriptResponse
from service import run_transcription

app = FastAPI(title="Speakle Whisper Service")

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Accepts an extracted mp3 as a multipart upload and returns the transcript.
# The Java backend does the ffmpeg extraction and POSTs the mp3 bytes here.
@app.post("/transcribe", response_model=TranscriptResponse)
async def transcribe(file: UploadFile = File(...)) -> TranscriptResponse:
    contents = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        return run_transcription(tmp_path)
    finally:
        os.remove(tmp_path)
