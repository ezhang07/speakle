import sys
import json
from faster_whisper import WhisperModel

# audio path comes in as a command-line argument from Java
audio_path = sys.argv[1]

model = WhisperModel("base", device="cpu", compute_type="int8")

segments, info = model.transcribe(audio_path, word_timestamps=True, initial_prompt="Um, uh, like, you know, I mean, well, so, actually, basically, literally, right, okay, alright, I guess, I think, I feel like")

# build result with full text + flat list of words with timestamps
words = []
full_text = []
for segment in segments:
    full_text.append(segment.text)
    for w in segment.words:
        words.append({
            "word": w.word,
            "start": round(w.start, 2),
            "end": round(w.end, 2),
        })

result = {
    "text": "".join(full_text).strip(),
    "words": words,
}

print(json.dumps(result))