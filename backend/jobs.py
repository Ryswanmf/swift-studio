"""
jobs.py - Manajemen model database SQLite dan Background Worker untuk Swift Studio.

Background worker menggunakan ThreadPoolExecutor (1-2 worker bersamaan) yang cocok
untuk MVP.

Untuk upgrade ke Celery + Redis di skala produksi:
1. Ganti ThreadPoolExecutor dengan Celery app (misal: `celery_app = Celery("swift_studio", broker="redis://localhost:6379/0")`).
2. Ubah fungsi `_execute_job(job_id)` menjadi Celery task dengan decorator `@celery_app.task`.
3. Panggil `_execute_job.delay(job_id)` pada fungsi `submit_job()`.
4. Jalankan Celery worker di container/proses terpisah: `celery -A jobs.celery_app worker --loglevel=info -c 2`.
"""

import json
import logging
import os
import shutil
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from dotenv import load_dotenv

# Muat environment variable sebelum mengimpor pipeline
load_dotenv()

from pipeline import process_video, render_clip, to_sec, Clip, Segment

logger = logging.getLogger("swift_studio.jobs")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
OUTPUTS_DIR = STORAGE_DIR / "outputs"
DB_PATH = STORAGE_DIR / "jobs.db"

# Pastikan folder penyimpanan tersedia
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# Thread pool worker untuk pemrosesan video background
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))
executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_JOBS, thread_name_prefix="JobWorker")
_db_lock = threading.Lock()


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Inisialisasi tabel jobs di database SQLite."""
    with _db_lock, get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                num_clips INTEGER NOT NULL DEFAULT 6,
                burn_captions INTEGER NOT NULL DEFAULT 1,
                language TEXT NOT NULL DEFAULT 'Indonesia',
                status TEXT NOT NULL DEFAULT 'queued',
                progress INTEGER NOT NULL DEFAULT 0,
                message TEXT NOT NULL DEFAULT 'Menunggu antrean...',
                clips TEXT NOT NULL DEFAULT '[]',
                transcript TEXT NOT NULL DEFAULT '[]',
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at)")
        conn.commit()
    logger.info("Database SQLite berhasil diinisialisasi di %s", DB_PATH)


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    d["burn_captions"] = bool(d["burn_captions"])
    try:
        d["clips"] = json.loads(d["clips"]) if d["clips"] else []
    except Exception:
        d["clips"] = []
    try:
        d["transcript"] = json.loads(d["transcript"]) if d["transcript"] else []
    except Exception:
        d["transcript"] = []
    return d


def create_job(
    job_id: str,
    filename: str,
    file_path: str,
    file_size: int,
    num_clips: int = 6,
    burn_captions: bool = True,
    language: str = "Indonesia",
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    with _db_lock, get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO jobs (
                id, filename, file_path, file_size, num_clips, burn_captions,
                language, status, progress, message, clips, transcript, error,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                filename,
                file_path,
                file_size,
                num_clips,
                1 if burn_captions else 0,
                language,
                "queued",
                0,
                "Menunggu antrean pemrosesan...",
                "[]",
                "[]",
                None,
                now,
                now,
            ),
        )
        conn.commit()
    return get_job(job_id) # type: ignore


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _db_lock, get_db_connection() as conn:
        cursor = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_dict(row)


def list_jobs(limit: int = 50) -> List[Dict[str, Any]]:
    with _db_lock, get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)
        )
        return [_row_to_dict(r) for r in cursor.fetchall()]


def update_job_progress(job_id: str, progress: int, message: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _db_lock, get_db_connection() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET status = 'processing', progress = ?, message = ?, updated_at = ?
            WHERE id = ?
            """,
            (progress, message, now, job_id),
        )
        conn.commit()


def mark_job_done(
    job_id: str, clips: List[Dict[str, Any]], transcript: List[Dict[str, Any]]
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _db_lock, get_db_connection() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET status = 'done', progress = 100, message = 'Selesai! Klip siap ditonton dan diunduh.',
                clips = ?, transcript = ?, error = NULL, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(clips, ensure_ascii=False), json.dumps(transcript, ensure_ascii=False), now, job_id),
        )
        conn.commit()


def mark_job_error(job_id: str, error_message: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _db_lock, get_db_connection() as conn:
        conn.execute(
            """
            UPDATE jobs
            SET status = 'error', message = 'Terjadi kesalahan saat memproses video',
                error = ?, updated_at = ?
            WHERE id = ?
            """,
            (error_message, now, job_id),
        )
        conn.commit()


def delete_job(job_id: str) -> bool:
    """Hapus data job dari database dan hapus seluruh filenya di disk."""
    job = get_job(job_id)
    if not job:
        return False

    with _db_lock, get_db_connection() as conn:
        conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        conn.commit()

    # Hapus file upload asli jika ada
    upload_path = Path(job.get("file_path", ""))
    if upload_path.exists():
        try:
            upload_path.unlink()
        except Exception as e:
            logger.warning("Gagal menghapus file upload %s: %s", upload_path, e)

    # Hapus folder output
    out_dir = OUTPUTS_DIR / job_id
    if out_dir.exists():
        try:
            shutil.rmtree(out_dir, ignore_errors=True)
        except Exception as e:
            logger.warning("Gagal menghapus output dir %s: %s", out_dir, e)

    logger.info("Job %s dan filenya berhasil dihapus", job_id)
    return True


def cleanup_old_data(max_age_hours: int = 24) -> int:
    """Membersihkan file dan job yang lebih tua dari batas jam tertentu."""
    now_ts = time.time()
    cutoff_ts = now_ts - (max_age_hours * 3600)
    cleaned_count = 0

    with _db_lock, get_db_connection() as conn:
        cursor = conn.execute("SELECT id, file_path, created_at FROM jobs")
        rows = cursor.fetchall()

    for row in rows:
        job_id = row["id"]
        created_at_str = row["created_at"]
        try:
            dt = datetime.fromisoformat(created_at_str)
            job_ts = dt.timestamp()
            if job_ts < cutoff_ts:
                delete_job(job_id)
                cleaned_count += 1
        except Exception as e:
            logger.error("Error saat memeriksa umur job %s: %s", job_id, e)

    # Bersihkan file upload terlantar jika ada
    for f in UPLOADS_DIR.glob("*"):
        if f.is_file() and f.stat().st_mtime < cutoff_ts:
            try:
                f.unlink()
            except Exception:
                pass

    if cleaned_count > 0:
        logger.info("Cleanup selesai: %d job lama dibersihkan", cleaned_count)
    return cleaned_count


def _execute_job(job_id: str) -> None:
    """Fungsi target worker yang menjalankan pipeline video di thread pool terpisah."""
    logger.info("Memulai eksekusi job: %s", job_id)
    job = get_job(job_id)
    if not job:
        logger.error("Job %s tidak ditemukan di database", job_id)
        return

    # Validasi API Key Gemini
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "isi_api_key_anda":
        err_msg = (
            "GEMINI_API_KEY belum dikonfigurasi di file .env backend. "
            "Silakan atur GEMINI_API_KEY dengan API key Google AI Studio yang valid."
        )
        logger.error(err_msg)
        mark_job_error(job_id, err_msg)
        return

    video_path = job["file_path"]
    if not Path(video_path).exists():
        err_msg = f"File video tidak ditemukan di server: {video_path}"
        logger.error(err_msg)
        mark_job_error(job_id, err_msg)
        return

    out_dir = OUTPUTS_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    def on_progress(pct: int, msg: str):
        update_job_progress(job_id, pct, msg)
        logger.info("[%s] [%3d%%] %s", job_id, pct, msg)

    try:
        update_job_progress(job_id, 2, "Mempersiapkan pemrosesan video...")
        res = process_video(
            video_path=video_path,
            out_dir=str(out_dir),
            num_clips=job["num_clips"],
            language=job["language"],
            burn_captions=job["burn_captions"],
            on_progress=on_progress,
        )

        # Format data clips agar mudah dikonsumsi frontend
        formatted_clips = []
        for i, clip in enumerate(res.get("clips", []), start=1):
            file_path = clip.get("file", "")
            file_name = Path(file_path).name if file_path else f"clip-{i}.mp4"
            start_str = clip.get("start", "00:00")
            end_str = clip.get("end", "00:00")
            try:
                dur = round(to_sec(end_str) - to_sec(start_str), 1)
            except Exception:
                dur = 0.0

            formatted_clips.append(
                {
                    "index": i,
                    "title": clip.get("title", f"Klip {i}"),
                    "start": start_str,
                    "end": end_str,
                    "duration": dur,
                    "score": clip.get("score", 5),
                    "reason": clip.get("reason", ""),
                    "file_name": file_name,
                    "download_url": f"/api/jobs/{job_id}/clips/{i}/download",
                    "stream_url": f"/api/jobs/{job_id}/clips/{i}/stream",
                }
            )

        transcript = res.get("transcript", [])
        mark_job_done(job_id, formatted_clips, transcript)
        logger.info("Job %s sukses selesai dengan %d klip", job_id, len(formatted_clips))

    except Exception as e:
        logger.exception("Terjadi error saat memproses job %s: %s", job_id, e)
        friendly_error = f"Gagal memproses video: {str(e)}"
        mark_job_error(job_id, friendly_error)


def submit_job(job_id: str) -> None:
    """Mengirim job ke antrean ThreadPoolExecutor."""
    executor.submit(_execute_job, job_id)
    logger.info("Job %s telah dimasukkan ke ThreadPoolExecutor", job_id)


def rerender_single_clip(
    job_id: str,
    clip_index: int,
    new_start: Optional[str] = None,
    new_end: Optional[str] = None,
    new_title: Optional[str] = None,
    burn_captions: Optional[bool] = None,
) -> Dict[str, Any]:
    """Fitur Tahap 2: render ulang satu klip tertentu."""
    job = get_job(job_id)
    if not job:
        raise ValueError(f"Job {job_id} tidak ditemukan")

    clips = job.get("clips", [])
    if clip_index < 1 or clip_index > len(clips):
        raise ValueError(f"Index klip {clip_index} tidak valid (total: {len(clips)})")

    target_clip_dict = clips[clip_index - 1]
    transcript_data = job.get("transcript", [])
    segments = [Segment(**s) for s in transcript_data]

    start = new_start if new_start is not None else target_clip_dict["start"]
    end = new_end if new_end is not None else target_clip_dict["end"]
    title = new_title if new_title is not None else target_clip_dict["title"]
    burn = burn_captions if burn_captions is not None else job.get("burn_captions", True)

    clip_obj = Clip(
        start=start,
        end=end,
        title=title,
        score=target_clip_dict.get("score", 8),
        reason=target_clip_dict.get("reason", "Render ulang sesuai permintaan pengguna"),
    )

    out_dir = OUTPUTS_DIR / job_id
    out_path = out_dir / target_clip_dict["file_name"]

    render_clip(
        video_path=job["file_path"],
        clip=clip_obj,
        segments=segments,
        out_path=str(out_path),
        burn_captions=burn,
    )

    # Perbarui informasi klip di database
    target_clip_dict["start"] = start
    target_clip_dict["end"] = end
    target_clip_dict["title"] = title
    try:
        target_clip_dict["duration"] = round(to_sec(end) - to_sec(start), 1)
    except Exception:
        pass

    clips[clip_index - 1] = target_clip_dict
    with _db_lock, get_db_connection() as conn:
        conn.execute(
            "UPDATE jobs SET clips = ?, updated_at = ? WHERE id = ?",
            (json.dumps(clips, ensure_ascii=False), datetime.now(timezone.utc).isoformat(), job_id),
        )
        conn.commit()

    return target_clip_dict
