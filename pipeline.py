"""
pipeline.py - Mesin pemrosesan: video panjang -> klip vertikal 9:16 (<=60 detik) + caption.

Dependensi:
    pip install google-genai pydantic
    FFmpeg harus terinstall (ffmpeg -version)

Env:
    GEMINI_API_KEY=...
    GEMINI_MODEL=gemini-flash-latest   (opsional, cek nama model terbaru di docs Gemini)
"""
import os
import re
import json
import subprocess
import time
from pathlib import Path
from typing import Callable, Optional

# Tambahkan direktori bin lokal ke PATH jika ada
_bin_dir = str(Path(__file__).resolve().parent / "bin")
if Path(_bin_dir).exists() and _bin_dir not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"{_bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"

from google import genai
from google.genai import types
from pydantic import BaseModel

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
MAX_CLIP_SEC = 60
MIN_CLIP_SEC = 15


# ---------- Skema output Gemini ----------
class Segment(BaseModel):
    start: str  # "MM:SS" atau "HH:MM:SS"
    end: str
    text: str


class Clip(BaseModel):
    start: str
    end: str
    title: str
    score: int  # 1-10
    reason: str


# ---------- Util ----------
def client() -> genai.Client:
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def to_sec(ts: str) -> float:
    """'MM:SS' / 'HH:MM:SS' (boleh ada desimal) -> detik."""
    parts = [float(p) for p in ts.strip().split(":")]
    sec = 0.0
    for p in parts:
        sec = sec * 60 + p
    return sec


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Command gagal: {' '.join(cmd)}\n{r.stderr[-1500:]}")


def video_duration(path: str) -> float:
    # Coba gunakan ffprobe terlebih dahulu
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True,
        )
        if r.returncode == 0 and r.stdout.strip():
            return float(r.stdout.strip())
    except Exception:
        pass

    # Fallback ke ffmpeg jika ffprobe tidak terpasang
    r = subprocess.run(["ffmpeg", "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", r.stderr)
    if m:
        h, m_, s = float(m.group(1)), float(m.group(2)), float(m.group(3))
        return h * 3600 + m_ * 60 + s
    raise RuntimeError(f"Gagal mendeteksi durasi video dari: {path}")


# ---------- Langkah 1: ekstrak audio ----------
def extract_audio(video_path: str, out_path: str) -> str:
    run(["ffmpeg", "-y", "-i", video_path, "-vn", "-ac", "1", "-ar", "16000",
         "-b:a", "48k", out_path])
    return out_path


def upload_audio(c: genai.Client, audio_path: str):
    f = c.files.upload(file=audio_path)
    while f.state and f.state.name == "PROCESSING":
        time.sleep(2)
        f = c.files.get(name=f.name)
    return f


# ---------- Langkah 2: transkrip bertimestamp ----------
def transcribe(c: genai.Client, audio_file, language: str = "Indonesia") -> list[Segment]:
    prompt = f"""
Transkripsikan audio ini secara lengkap dalam bahasa {language}.
Pecah menjadi segmen pendek (sekitar 3-8 detik, satu kalimat atau frasa).
Setiap segmen punya start dan end dalam format MM:SS (atau HH:MM:SS jika lebih dari 1 jam).
Timestamp harus akurat dan berurutan. Jangan menambah atau merangkum isi.
"""
    resp = c.models.generate_content(
        model=MODEL,
        contents=[audio_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=list[Segment],
        ),
    )
    return resp.parsed or []


# ---------- Langkah 3: pilih klip menarik ----------
def pick_clips(c: genai.Client, segments: list[Segment], n: int = 6) -> list[Clip]:
    transcript = "\n".join(f"[{s.start} - {s.end}] {s.text}" for s in segments)
    prompt = f"""
Berikut transkrip video panjang dengan timestamp:

{transcript}

Pilih {n} segmen terbaik untuk YouTube Shorts.
Aturan:
- Durasi {MIN_CLIP_SEC}-{MAX_CLIP_SEC} detik (utamakan 30-55 detik).
- Awal klip harus punya hook kuat (pertanyaan, klaim berani, cerita menarik).
- Ide utuh, tidak terpotong di tengah kalimat. Mulai dan akhir di batas segmen.
- Tidak boleh tumpang tindih.
- start/end memakai format timestamp yang sama dengan transkrip.
- title: judul singkat menarik (maks 60 karakter), bahasa Indonesia.
- score: 1-10 potensi viral. reason: 1 kalimat alasan.
Urutkan dari score tertinggi.
"""
    resp = c.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=list[Clip],
        ),
    )
    return resp.parsed or []


def validate_clips(clips: list[Clip], total_sec: float) -> list[Clip]:
    """Buang klip tidak valid: durasi di luar batas, melewati video, atau tumpang tindih."""
    valid: list[Clip] = []
    for clip in clips:
        try:
            s, e = to_sec(clip.start), to_sec(clip.end)
        except Exception:
            continue
        dur = e - s
        if dur < MIN_CLIP_SEC or dur > MAX_CLIP_SEC or e > total_sec + 1 or s < 0:
            continue
        if any(not (e <= to_sec(v.start) or s >= to_sec(v.end)) for v in valid):
            continue
        valid.append(clip)
    return valid


# ---------- Langkah 4: caption (ASS) ----------
def _ass_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def build_ass(segments: list[Segment], clip_start: float, clip_end: float,
              words_per_chunk: int = 3) -> str:
    """Caption per 2-4 kata. Timing kata dibagi rata di dalam tiap segmen (perkiraan)."""
    lines = [ASS_HEADER]
    for seg in segments:
        ss, se = to_sec(seg.start), to_sec(seg.end)
        if se <= clip_start or ss >= clip_end:
            continue
        words = seg.text.split()
        if not words or se <= ss:
            continue
        per_word = (se - ss) / len(words)
        for i in range(0, len(words), words_per_chunk):
            chunk = words[i:i + words_per_chunk]
            cs = max(ss + i * per_word, clip_start) - clip_start
            ce = min(ss + (i + len(chunk)) * per_word, clip_end) - clip_start
            if ce <= cs:
                continue
            text = " ".join(chunk).upper().replace("{", "(").replace("}", ")")
            lines.append(
                f"Dialogue: 0,{_ass_time(cs)},{_ass_time(ce)},Default,,0,0,0,,{text}"
            )
    return "\n".join(lines)


# ---------- Langkah 5: potong + crop 9:16 + burn caption ----------
def render_clip(video_path: str, clip: Clip, segments: list[Segment],
                out_path: str, burn_captions: bool = True) -> str:
    s, e = to_sec(clip.start), to_sec(clip.end)
    vf = "crop='min(iw,ih*9/16)':ih,scale=1080:1920"
    ass_path = None
    if burn_captions:
        ass_path = str(Path(out_path).with_suffix(".ass"))
        Path(ass_path).write_text(build_ass(segments, s, e), encoding="utf-8")
        esc = ass_path.replace("\\", "/").replace(":", r"\:")
        vf += f",ass='{esc}'"
    run(["ffmpeg", "-y", "-ss", str(s), "-i", video_path, "-t", str(e - s),
         "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out_path])
    return out_path


# ---------- Orkestrasi ----------
def process_video(video_path: str, out_dir: str, num_clips: int = 6,
                  language: str = "Indonesia", burn_captions: bool = True,
                  on_progress: Optional[Callable[[int, str], None]] = None) -> dict:
    def progress(pct: int, msg: str):
        if on_progress:
            on_progress(pct, msg)

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    c = client()

    progress(5, "Mengekstrak audio")
    audio_path = extract_audio(video_path, str(out / "audio.mp3"))
    total = video_duration(video_path)

    progress(15, "Mengunggah audio ke Gemini")
    audio_file = upload_audio(c, audio_path)

    progress(30, "Membuat transkrip")
    segments = transcribe(c, audio_file, language)
    (out / "transcript.json").write_text(
        json.dumps([s.model_dump() for s in segments], ensure_ascii=False, indent=2),
        encoding="utf-8")

    progress(50, "Memilih klip menarik")
    clips = validate_clips(pick_clips(c, segments, num_clips), total)

    results = []
    for i, clip in enumerate(clips, 1):
        progress(55 + int(40 * i / max(len(clips), 1)), f"Render klip {i}/{len(clips)}")
        safe = re.sub(r"[^a-zA-Z0-9]+", "-", clip.title).strip("-")[:40] or f"clip-{i}"
        fp = render_clip(video_path, clip, segments,
                         str(out / f"{i:02d}-{safe}.mp4"), burn_captions)
        results.append({**clip.model_dump(), "file": fp})

    progress(100, "Selesai")
    return {"clips": results, "transcript": [s.model_dump() for s in segments]}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Pemakaian: python pipeline.py video.mp4 [folder_output]")
        raise SystemExit(1)
    res = process_video(
        sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "output",
        on_progress=lambda p, m: print(f"[{p:3d}%] {m}"))
    for r in res["clips"]:
        print(f"- {r['title']} ({r['start']}-{r['end']}) score {r['score']} -> {r['file']}")
