"""
main.py - FastAPI Application untuk Swift Studio Backend.
Menyediakan REST API untuk upload video, background processing,
polling progress, video streaming (Range support), dan download klip.
"""

import io
import logging
import os
import re
import threading
import time
import uuid
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles
from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Header,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

# Muat environment variables
load_dotenv()

from jobs import (
    OUTPUTS_DIR,
    UPLOADS_DIR,
    cleanup_old_data,
    create_job,
    delete_job,
    get_job,
    init_db,
    list_jobs,
    rerender_single_clip,
    submit_job,
)

logger = logging.getLogger("swift_studio.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "2048"))  # Default 2 GB
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}
ALLOWED_MIME_PREFIXES = ("video/", "application/octet-stream")

# Flag interval background cleanup
_stop_cleanup_event = threading.Event()


def _periodic_cleanup_worker():
    """Menjalankan pembersihan file > 24 jam setiap 1 jam."""
    logger.info("Background cleanup worker dimulai")
    while not _stop_cleanup_event.is_set():
        try:
            cleanup_old_data(max_age_hours=24)
        except Exception as e:
            logger.error("Terjadi kesalahan pada periodic cleanup: %s", e)
        # Tunggu 1 jam (3600 detik) atau hingga shutdown
        _stop_cleanup_event.wait(timeout=3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Inisialisasi database SQLite dan task periodik
    init_db()
    cleanup_thread = threading.Thread(
        target=_periodic_cleanup_worker, daemon=True, name="CleanupThread"
    )
    cleanup_thread.start()
    logger.info("Swift Studio Backend siap melayani request")
    yield
    # Shutdown
    _stop_cleanup_event.set()
    logger.info("Swift Studio Backend shutdown")


app = FastAPI(
    title="Swift Studio API",
    description="Backend API untuk memproses video panjang menjadi klip vertikal 9:16 dengan caption otomatis.",
    version="1.0.0",
    lifespan=lifespan,
)

# Konfigurasi CORS
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "app": "Swift Studio API",
        "status": "online",
        "docs": "/docs",
        "max_upload_mb": MAX_UPLOAD_MB,
    }


@app.get("/api/health")
def health_check():
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    key_configured = bool(gemini_key and gemini_key != "isi_api_key_anda")
    return {
        "status": "healthy",
        "app_name": "Swift Studio",
        "gemini_api_key_configured": key_configured,
        "max_upload_mb": MAX_UPLOAD_MB,
    }


@app.post("/api/jobs", status_code=status.HTTP_201_CREATED)
async def create_new_job(
    file: UploadFile = File(...),
    num_clips: int = Form(6),
    burn_captions: bool = Form(True),
    language: str = Form("Indonesia"),
):
    """
    Endpoint untuk membuat job baru.
    Menerima upload video multipart, memvalidasi ukuran & format,
    lalu mengirimnya ke antrean background worker.
    """
    filename = file.filename or "video.mp4"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format file '{ext}' tidak didukung. Harap upload video berekstensi: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Validasi parameter
    if num_clips < 1 or num_clips > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jumlah klip (num_clips) harus bernilai antara 1 sampai 10.",
        )

    job_id = str(uuid.uuid4())
    safe_name = re.sub(r"[^a-zA-Z0-9_\.-]", "_", filename)
    target_path = UPLOADS_DIR / f"{job_id}_{safe_name}"

    # Simpan file secara streaming untuk menghemat memory
    total_bytes = 0
    try:
        async with aiofiles.open(target_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):  # Chunk 1MB
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    # Hapus file parsial jika melebihi kuota
                    await file.close()
                    if target_path.exists():
                        target_path.unlink()
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Ukuran file melebihi batas maksimum {MAX_UPLOAD_MB} MB.",
                    )
                await out_file.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if target_path.exists():
            target_path.unlink()
        logger.error("Gagal menyimpan upload video: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan file upload ke server: {str(e)}",
        )

    # Buat record di SQLite
    job = create_job(
        job_id=job_id,
        filename=filename,
        file_path=str(target_path),
        file_size=total_bytes,
        num_clips=num_clips,
        burn_captions=burn_captions,
        language=language,
    )

    # Masukkan ke antrean thread pool
    submit_job(job_id)

    return {
        "job_id": job_id,
        "filename": filename,
        "file_size_mb": round(total_bytes / (1024 * 1024), 2),
        "status": "queued",
        "message": "Video berhasil diunggah. Job telah dimasukkan ke dalam antrean pemrosesan.",
    }


@app.get("/api/jobs")
def get_recent_jobs(limit: int = Query(30, ge=1, le=100)):
    """Mengambil daftar job terbaru untuk halaman riwayat."""
    return list_jobs(limit=limit)


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    """
    Endpoint polling status job.
    Mengembalikan progress (0-100), pesan tahapan, daftar klip jika selesai, atau pesan error.
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job dengan ID '{job_id}' tidak ditemukan.",
        )
    return job


@app.get("/api/jobs/{job_id}/transcript")
def get_job_transcript(job_id: str):
    """Mengambil transkrip dialog video bertimestamp."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")

    transcript = job.get("transcript", [])
    if transcript:
        return transcript

    # Fallback ke file transcript.json di disk jika ada
    transcript_file = OUTPUTS_DIR / job_id / "transcript.json"
    if transcript_file.exists():
        try:
            import json
            return json.loads(transcript_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    return []


def _resolve_clip_file(job_id: str, index: int) -> Path:
    """Helper untuk memvalidasi dan mencari path file klip berdasarkan index (1-based)."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")

    clips = job.get("clips", [])
    if not clips or index < 1 or index > len(clips):
        raise HTTPException(
            status_code=404,
            detail=f"Klip index {index} tidak ditemukan untuk job ini (total klip: {len(clips)}).",
        )

    target_clip = clips[index - 1]
    file_name = target_clip.get("file_name")
    if not file_name:
        raise HTTPException(status_code=404, detail="Nama file klip tidak valid.")

    file_path = OUTPUTS_DIR / job_id / file_name
    if not file_path.exists():
        # Coba fallback ke file pertama di direktori jika nama berbeda
        candidates = list((OUTPUTS_DIR / job_id).glob(f"{index:02d}-*.mp4"))
        if candidates and candidates[0].exists():
            return candidates[0]
        raise HTTPException(
            status_code=404, detail=f"File klip video belum tersedia di server: {file_name}"
        )
    return file_path


@app.get("/api/jobs/{job_id}/clips/{index}/download")
def download_clip(job_id: str, index: int):
    """Download file MP4 klip vertikal."""
    file_path = _resolve_clip_file(job_id, index)
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type="video/mp4",
        content_disposition_type="attachment",
    )


@app.get("/api/jobs/{job_id}/clips/{index}/stream")
def stream_clip(job_id: str, index: int, request: Request):
    """
    Streaming MP4 untuk video player preview dengan dukungan HTTP Range Request (206 Partial Content).
    Memungkinkan HTML5 video seek instan.
    """
    file_path = _resolve_clip_file(job_id, index)
    file_size = file_path.stat().st_size
    content_type = "video/mp4"

    range_header = request.headers.get("Range") or request.headers.get("range")

    if range_header:
        # Format umum: bytes=start-end atau bytes=start-
        match = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            end_val = match.group(2)
            end = int(end_val) if end_val else file_size - 1

            if start >= file_size or end >= file_size or start > end:
                return Response(
                    status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                    headers={"Content-Range": f"bytes */{file_size}"},
                )

            chunk_length = end - start + 1

            def range_generator():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    remaining = chunk_length
                    while remaining > 0:
                        chunk_size = min(64 * 1024, remaining)
                        data = f.read(chunk_size)
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_length),
                "Content-Type": content_type,
            }
            return StreamingResponse(
                range_generator(),
                status_code=status.HTTP_206_PARTIAL_CONTENT,
                headers=headers,
            )

    # Full content response
    def full_generator():
        with open(file_path, "rb") as f:
            while chunk := f.read(64 * 1024):
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type,
    }
    return StreamingResponse(full_generator(), status_code=200, headers=headers)


@app.get("/api/jobs/{job_id}/download-all")
def download_all_clips_zip(job_id: str):
    """Mengompres seluruh klip MP4 menjadi satu file .zip untuk diunduh bersamaan."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")

    out_dir = OUTPUTS_DIR / job_id
    if not out_dir.exists():
        raise HTTPException(status_code=404, detail="Folder output klip belum tersedia.")

    mp4_files = sorted(list(out_dir.glob("*.mp4")))
    if not mp4_files:
        raise HTTPException(status_code=404, detail="Belum ada file klip MP4 yang selesai dirender.")

    # Buat arsip zip di memory stream
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for mp4 in mp4_files:
            zip_file.write(mp4, arcname=mp4.name)

        # Sertakan juga transcript.json jika ada
        transcript_file = out_dir / "transcript.json"
        if transcript_file.exists():
            zip_file.write(transcript_file, arcname="transcript.json")

    zip_buffer.seek(0)
    zip_filename = f"SwiftStudio_{job_id[:8]}_shorts.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )


@app.delete("/api/jobs/{job_id}")
def remove_job(job_id: str):
    """Menghapus data job dan semua file video terkait dari server."""
    success = delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Job {job_id} tidak ditemukan.")
    return {"success": True, "message": f"Job {job_id} dan filenya berhasil dihapus."}


class RerenderRequest(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None
    title: Optional[str] = None
    burn_captions: Optional[bool] = None


@app.post("/api/jobs/{job_id}/clips/{index}/rerender")
def rerender_clip_endpoint(job_id: str, index: int, req: RerenderRequest):
    """Fitur Tahap 2: render ulang satu klip dengan penyesuaian waktu atau judul."""
    try:
        updated_clip = rerender_single_clip(
            job_id=job_id,
            clip_index=index,
            new_start=req.start,
            new_end=req.end,
            new_title=req.title,
            burn_captions=req.burn_captions,
        )
        return {
            "success": True,
            "message": f"Klip #{index} berhasil dirender ulang.",
            "clip": updated_clip,
        }
    except Exception as e:
        logger.error("Gagal render ulang klip %d di job %s: %s", index, job_id, e)
        raise HTTPException(status_code=400, detail=str(e))
