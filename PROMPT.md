# PROMPT UNTUK AI BUILDER

> Salin semua isi di bawah garis ini ke AI coding Anda (Cursor, Claude Code, Lovable, dll).
> Sertakan juga file `pipeline.py`, `requirements.txt`, dan `.env.example` dari folder ini.

---

Bangun web app bernama **ClipForge**: pengguna mengunggah video panjang, lalu sistem otomatis membuat beberapa klip vertikal 9:16 berdurasi maksimal 60 detik untuk YouTube Shorts, lengkap dengan caption (closed caption yang dibakar ke video). Seluruh UI berbahasa Indonesia.

## Aturan penting
- **Jangan buat ulang logika pemrosesan video.** Sudah ada `pipeline.py` yang siap dipakai. Impor fungsi `process_video(video_path, out_dir, num_clips, language, burn_captions, on_progress)` dari file itu dan jangan ubah perilakunya kecuali ada bug.
- AI yang dipakai adalah **Gemini API** (sudah ditangani di `pipeline.py`). API key dibaca dari env `GEMINI_API_KEY`, tidak boleh muncul di frontend.
- **Input hanya upload file** (mp4, mov, mkv, webm). Jangan buat fitur download dari link YouTube, karena melanggar ToS YouTube. Tampilkan checkbox wajib: "Saya memiliki hak atas video ini atau sudah mendapat izin untuk memprosesnya."
- Pemrosesan video berat dan lama, jadi **harus berjalan sebagai background job** dengan progress, bukan di dalam request HTTP.

## Stack
- **Backend:** Python 3.11+, FastAPI, SQLite (via SQLModel atau sqlite3) untuk menyimpan job. Background worker memakai `ThreadPoolExecutor` dengan maksimal 1-2 job bersamaan (cukup untuk MVP; beri komentar bagaimana upgrade ke Celery/Redis).
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS. Tema gelap yang bersih dan modern, responsif untuk mobile.
- **FFmpeg** harus terinstall di server; sediakan `Dockerfile` yang menginstalnya.

## Struktur folder
```
clipforge/
  backend/
    main.py            # FastAPI app
    jobs.py            # model job + worker
    pipeline.py        # SUDAH ADA, jangan ditulis ulang
    requirements.txt
    storage/           # uploads/ dan outputs/<job_id>/
  frontend/            # Next.js
  Dockerfile
  docker-compose.yml
  README.md
```

## API backend
| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/jobs` | multipart: `file`, `num_clips` (1-10, default 6), `burn_captions` (bool, default true), `language` (default "Indonesia"). Simpan file, buat job, jalankan di background, kembalikan `{job_id}` |
| GET | `/api/jobs/{id}` | `{status: queued/processing/done/error, progress: 0-100, message, clips: [...], error}` |
| GET | `/api/jobs/{id}/clips/{index}/download` | unduh mp4 klip |
| GET | `/api/jobs/{id}/clips/{index}/stream` | streaming mp4 untuk preview (dukung Range request) |
| GET | `/api/jobs/{id}/transcript` | transkrip JSON |
| DELETE | `/api/jobs/{id}` | hapus job dan semua filenya |

Ketentuan:
- Batasi ukuran upload (default 2 GB, atur lewat env `MAX_UPLOAD_MB`) dan validasi ekstensi serta tipe file.
- Simpan progress dari callback `on_progress` ke database agar bisa di-poll.
- Tangkap semua error dari pipeline, simpan pesan error yang ramah, dan set status `error`.
- Bersihkan file upload asli dan hasil yang lebih tua dari 24 jam (task periodik sederhana).
- Aktifkan CORS untuk origin frontend.

## Halaman frontend
1. **Beranda (`/`)**
   - Hero singkat: "Ubah video panjang jadi Shorts dalam hitungan menit."
   - Dropzone drag-and-drop dengan progress upload.
   - Opsi: jumlah klip (slider 1-10), toggle "Bakar caption ke video", pilihan bahasa (Indonesia/English).
   - Checkbox hak cipta (wajib dicentang sebelum tombol aktif).
   - Tombol "Buat Klip".
2. **Halaman job (`/jobs/[id]`)**
   - Progress bar dan pesan tahap saat ini (polling tiap 2 detik, berhenti saat done/error).
   - Setelah selesai: grid kartu klip dengan video player vertikal 9:16, judul, badge skor viral (1-10), alasan singkat, durasi, tombol **Download**, dan tombol **Salin judul**.
   - Tombol "Download semua" (zip).
   - Tab "Transkrip" yang menampilkan transkrip dengan timestamp.
   - Penanganan state error dengan tombol "Coba lagi".
3. **Riwayat (`/history`)**: daftar job dari browser ini (simpan ID di localStorage), dengan status dan link.

## Fitur tahap 2 (buat strukturnya, tapi implementasi belakangan jika terlalu panjang)
- Editor klip: geser start/end, ubah teks caption, lalu render ulang satu klip. Tambahkan fungsi `render_clip` di endpoint `POST /api/jobs/{id}/clips/{index}/rerender`.
- Pilihan gaya caption (putih, kuning, kotak hitam).
- Face tracking untuk crop otomatis mengikuti pembicara (MediaPipe).

## UX dan kualitas
- Loading, empty, dan error state di semua halaman.
- Semua teks UI dalam bahasa Indonesia.
- Validasi sisi klien dan server.
- Kode rapi, ada type hints, dan komentar pada bagian yang tidak jelas.
- Jangan hardcode path; gunakan env var dan `pathlib`.

## README harus berisi
- Cara install dependensi (FFmpeg, Python, Node).
- Cara mengisi `.env` dan menjalankan lokal (`uvicorn` dan `npm run dev`).
- Cara deploy dengan Docker.
- Catatan: jangan deploy backend di serverless (Vercel/Netlify Functions) karena kena timeout. Gunakan VPS atau container (Railway, Fly.io, Hetzner).

## Kriteria selesai
- [ ] Upload video 10 menit menghasilkan beberapa klip mp4 vertikal 1080x1920, maksimal 60 detik.
- [ ] Caption terbakar di video dan terbaca jelas.
- [ ] Progress bar bergerak sesuai tahap di `pipeline.py`.
- [ ] Klip bisa diputar langsung di browser dan diunduh.
- [ ] API key tidak pernah terekspos ke browser.
- [ ] Berjalan lewat `docker-compose up`.

Mulai dengan backend (pastikan bisa dites lewat curl), lalu frontend. Setelah selesai, jelaskan cara menjalankannya.
