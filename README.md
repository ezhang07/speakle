# Speakle

a speaking-practice coach

the idea came alive when i saw a bunch of instagram reels of people recorded themselves speaking everyday to improve their speech. everyone who stuck to it saw big speech gains, such as less filler words, and more cohesion. i tried it out for myself, but i noticed there was a ton of friction inhibiting consistency: deciding what you wanted to talk about, scattered recordings, and re-watching your playback videos multiple times to count filler words and if what you said actually made sense. that's why i decided to build Speakle.

## how speakle works

the whole thing is built around a simple loop: **practice → feedback → review**, repeated over time.

- **practice**: pick a prompt, get a few seconds to think, then record yourself answering it right in the browser. no setup, no separate app
- **feedback**: speakle transcribes the take and reports back on *how* you spoke: filler-word count, pace (words per minute), longest pause, and a short written summary of the response. the transcript comes back with your filler words highlighted, and tapping one jumps the video straight to that moment
- **review**: every session is saved in one place, so you can rewatch old takes, reread the feedback, and actually see the filler words drop off over time

each user holds its own data. recordings and feedback are private to you.

## under the hood

a few things going on behind that loop:

- **direct browser S3 uploads**: the video bytes never pass through the backend. the browser asks for a short-lived **presigned S3 url**, then uploads the recording straight to S3 itself. the backend only signs the url, so it never has to hold a big file upload open or eat the bandwidth. playback works the same way, where a presigned url from S3 can directly stream the video.

- **two layers of feedback**: the deterministic metrics (filler count, words per minute, longest pause) are computed in plain Java over the timestamped transcript. there were some more "ambiguous" metrics that i thought would help, such as a bloat ratio (gemini creates a super concise version of what you said, then divide your transcript's length with its length), time-to-first-point (gemini uses its discretion to determine where you first started answering the prompt), and a written summary. these all came from the **Gemini API**, prompted to return structured JSON so the results drop straight into the session. the LLM points at *what* to look at; the exact math stays deterministic.
  
- **transcription as its own service**: i decided on self-hosting whisper rather than using the **OpenAI API**, because it allowed me to have more control on the transcription process from the model. whisper is trained on clean subtitles and, hence, drops filler words like "um" and "uh". in speakle's case, these filler words are exactly what we WANT to keep, rather than filter out, so i primed the model's context with some of these disfluencies, to bias the model into actually retaining them in the transcript. self-hosting also caused some detours in deployment, such as making it run as a separate FastAPI service, to convert from processing locally to HTTP calls.
  
- **everything containerized**: the backend, whisper service, and Postgres all run together under a single `docker compose up`, so the whole stack comes up with one command. it was overall very cool learning how to decouple all these services, and working with real infra for the first time.

- **first experiences with aws**: aws held a pretty vital role in terms of deployment and storage. i used aws s3 for video storage, taking advantage of its 11 9s of object durability and presigned URLs to handle video storage and transfers without burdening the backend. for relational data, i migrated from a self-hosted docker postgreSQL setup to aws rds for postgreSQL. rds offered durability through automated backups, which removed the risk of serious data loss in cases of hosting failure. i hosted the microservices on an aws ec2 instance running docker compose (essentially all my containers), and this helped demystify how deployment truly works behind the abstractions.

## tech stack

- **frontend**: React, TypeScript, Vite
- **backend**: Java, Spring Boot
- **transcription**: Python, FastAPI, faster-whisper, ffmpeg
- **ai feedback**: Google Gemini
- **data & storage**: Postgres (JPA/Hibernate), AWS (S3, RDS)
- **infra**: Docker Compose, AWS EC2


## what's to come

the core loop is live — record → transcribe → count/highlight fillers → clickable transcript → objective + AI feedback, all persisted per-user. next:

- **async job queue** — swap the in-process `@Async` for SQS + a separate worker, so a mid-job crash gets retried instead of orphaning the job (visibility timeout + DLQ)
- **trends dashboard** — chart the stored metric columns over time
- **per-user filler list** — starts common, grows as you add personal tics; unifies the filler set that's currently duplicated across the frontend and backend

## running locally

the whole backend stack (spring + whisper + postgres) runs together under docker compose.

you need `GEMINI_API_KEY` and `JWT_SECRET` (≥32 chars) set in your shell — the backend won't boot without them — plus `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` for S3.

### backend stack (from repo root)

```bash
docker compose up --build      # backend on :8080, whisper + postgres alongside
docker compose logs backend    # tail a service
```

### frontend (from `frontend/`)

```bash
npm install
npm run dev                    # Vite dev server, proxies /api -> :8080
```

frontend isn't containerized — it proxies `/api` to the backend on `:8080` in dev.
