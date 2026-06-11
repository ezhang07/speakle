# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Speakle transcribes uploaded audio/video recordings. A React frontend uploads a file
to a Spring Boot backend, which extracts audio with `ffmpeg` and runs local
faster-whisper transcription via a Python subprocess, returning JSON (`text` + word-level
timestamps).

## Architecture

The request flow crosses three runtimes — understanding the hand-offs matters more than any single file:

1. **Frontend** ([frontend/src/App.jsx](frontend/src/App.jsx)) — React 19 + Vite. Two ways to
   produce the input file: a file `<input>`, or **in-browser webcam+mic recording** via
   `getUserMedia` → `MediaRecorder` (chunks collected in a ref, assembled into a `video/webm`
   `File` in the recorder's `onstop` handler). Either way it's posted as `multipart/form-data`
   (field name **must** be `file`) to `/api/sessions/transcribe`. In dev, Vite proxies
   `/api` → `http://localhost:8080` ([frontend/vite.config.js](frontend/vite.config.js)).

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

## Roadmap — what to work on next

The owner is learning this codebase as they build it. When they return and ask "what was I
working on" or "what's next," point them here. Keep this list current (see *Maintaining this file*).

**In progress / next up:**
- [ ] **`useEffect` for the webcam lifecycle** (frontend). Auto-start the webcam on mount
  instead of via a button, and — importantly — return a cleanup function that stops the
  stream's tracks (`stream.current.getTracks().forEach(t => t.stop())`) on unmount.
  *Motivation:* there's a current resource leak — the camera/mic are never released, so the
  recording indicator stays on until the tab closes. This is the next planned milestone.
- [ ] **Collapse Start/Stop into one toggle button** driven by the `recording` state (small UX
  polish; folds in once the webcam auto-starts and the separate "Record from Webcam" button goes away).

**Backlog (not yet started):**
- [ ] **Render word-level timestamps.** `scripts/transcribe.py` already returns a `words` array
  with `start`/`end`, but the frontend only shows `result.text`. Could render clickable timestamped words.
- [ ] **Persist sessions to the DB.** JPA + PostgreSQL are wired up but there are no entities yet;
  nothing is saved. A `Session` entity storing transcripts would be the first real backend/JPA milestone.

## Maintaining this file

This file is meant to be **self-sustaining** — Claude should keep it accurate at its own
discretion, without being asked. When working in this repo:
- After completing or meaningfully advancing a roadmap item, **update the Roadmap section**:
  check off / remove what's done, and add any new next-steps that emerged from the work.
- When a change alters the architecture, commands, prerequisites, or one of the "key
  cross-cutting facts" above, **update the relevant section in the same change** so this file
  never drifts from reality.
- Prefer editing existing sections over appending; keep it concise and skip anything
  discoverable by reading the code.

### Working style for this repo
The owner is using this project to learn (React, browser media APIs, Spring). Default to
**guiding rather than writing code** — explain the concept, name the APIs, let them attempt it,
and review what they bring back — unless they explicitly say "you can code" / "make the change."
When teaching, favor one observable milestone at a time and "predict, then observe."
