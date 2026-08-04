# --- 1. Base image: Python runtime on a slim Debian (small, but not alpine which fights ML libs) ---
FROM python:3.12-slim

# --- 2. Working directory inside the image; everything below is relative to /app ---
WORKDIR /app

# --- 4 + 5. Dependencies FIRST (before the code) so this layer caches and only
#            re-runs when requirements.txt changes, not on every code edit.
#            --no-cache-dir keeps the image smaller (no pip download cache baked in). ---
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- 7. Bake the faster-whisper "base" model into the image at BUILD time so a
#        cold-started container doesn't download ~140MB on its first request.
#        Placed ABOVE the code copy on purpose: this download only depends on
#        faster-whisper (installed above), NOT on our .py files — so editing code
#        won't invalidate this slow layer. (least-changing steps go higher up.) ---
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu')"

# --- 6. Now the application code (changes often → copied LAST so edits only bust this cheap layer) ---
COPY *.py .

# --- 8. Document the port the app listens on (annotation; compose still maps it explicitly) ---
EXPOSE 8000

# --- 10. Start command. --host 0.0.0.0 (NOT localhost) so OTHER containers can reach it. ---
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
