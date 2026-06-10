# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Speakle transcribes uploaded audio/video recordings. A React frontend uploads a file
to a Spring Boot backend, which extracts audio with `ffmpeg` and runs local
faster-whisper transcription via a Python subprocess, returning JSON (`text` + word-level
timestamps).

## Architecture

The request flow crosses three runtimes — understanding the hand-offs matters more than any single file:

1. **Frontend** ([frontend/src/App.jsx](frontend/src/App.jsx)) — React 19 + Vite. Posts the
   file as `multipart/form-data` (field name **must** be `file`) to `/api/sessions/transcribe`.
   In dev, Vite proxies `/api` → `http://localhost:8080` ([frontend/vite.config.js](frontend/vite.config.js)).

2. **Backend controller** ([SessionController.java](src/main/java/dev/ethanz/speakle/controller/SessionController.java)) —
   single endpoint `POST /api/sessions/transcribe`, returns the Python script's JSON stdout verbatim as a string.

3. **TranscriptionService** ([TranscriptionService.java](src/main/java/dev/ethanz/speakle/service/TranscriptionService.java)) —
   the core pipeline. For each request it generates a UUID, then:
   - saves the upload to `./recordings/{uuid}.webm`,
   - shells out to `ffmpeg` to strip video and re-encode audio → `./recordings/{uuid}.mp3` (2-min timeout),
   - shells out to the Python interpreter running [scripts/transcribe.py](scripts/transcribe.py) with the mp3 path (5-min timeout),
   - returns the script's stdout JSON.

   Both subprocess steps read stdout fully before checking the exit code. Failures throw `RuntimeException`.

4. **Python transcriber** ([scripts/transcribe.py](scripts/transcribe.py)) — loads faster-whisper
   `base` model on CPU (`int8`), prints `{"text": ..., "words": [{word,start,end}...]}` to stdout.
   **stdout is the contract** — anything else printed there corrupts the JSON the backend returns.

### Key cross-cutting facts
- Subprocess binary/interpreter paths are injected from [application.properties](src/main/resources/application.properties):
  `ffmpeg.path`, `whisper.python` (defaults to `.venv/Scripts/python.exe`), `whisper.script`. Override
  these rather than hard-coding paths.
- JPA/PostgreSQL is wired up (`ddl-auto=update`) but **no entities or repositories exist yet** — the
  pipeline currently persists nothing to the database; recordings live only on disk.
- Multipart limits are raised to 200MB for large video uploads.

## Commands

Backend (run from repo root):
```sh
./mvnw spring-boot:run        # start backend on :8080
./mvnw test                   # run all tests
./mvnw test -Dtest=SpeakleApplicationTests#methodName   # single test
./mvnw clean package          # build jar
```

Frontend (run from `frontend/`):
```sh
npm install
npm run dev       # Vite dev server (proxies /api to :8080)
npm run build
npm run lint
```

Python transcription environment (one-time):
```sh
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt   # installs faster-whisper
```

## Prerequisites to run the full pipeline
- Java 21, a running PostgreSQL with a `speakle` database (user `postgres`; password via `DB_PASSWORD` env var, defaults to `password`).
- `ffmpeg` on PATH (or set `ffmpeg.path`).
- The `.venv` with faster-whisper installed (see above).
