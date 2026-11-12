# Swift Studio ⚡ — AI Video to Shorts Generator

<p align="center">
  <b>Ubah video panjang horizontal menjadi klip vertikal 9:16 (YouTube Shorts, TikTok, Reels) siap viral dalam hitungan menit menggunakan Gemini AI & FFmpeg.</b>
</p>

---

## 📌 Tentang Aplikasi: Ini Web Apa?

**Swift Studio** adalah aplikasi web modern berbasis kecerdasan buatan (*AI*) yang dirancang khusus untuk para **kreator konten, podcaster, YouTuber, dan digital marketer**.

Seringkali mengubah video berdurasi panjang (seperti rekaman podcast, webinar, wawancara, atau tutorial) menjadi klip pendek vertikal membutuhkan waktu berjam-jam untuk mencari momen menarik, memotong manual, memformat rasio 9:16, dan mengetik subtitle satu per satu.

**Swift Studio mengotomatiskan seluruh proses tersebut:**
1. **Ekstraksi Audio Cerdas:** Mengekstrak trek audio dari video resolusi tinggi dengan cepat.
2. **Transkripsi Akurat (Gemini API):** Mengonversi dialog video menjadi teks transkrip bertimestamp menggunakan model Google Gemini AI (`gemini-3.5-flash`).
3. **Kurasi Hook Viral:** AI menganalisis transkrip untuk menemukan bagian-bagian paling menarik (&le;60 detik), menilai potensi viralnya (skor 1–10), dan memberikan alasan kurasinya.
4. **Pemotongan & Formatting 9:16:** Meng-crop dan me-render video ke resolusi vertikal `1080x1920`.
5. **Dynamic Burn-in Subtitles:** Membakar caption teks dinamis (closed caption bergaya Shorts) langsung ke video (*hardsub*) per 2–4 kata agar penonton tetap terikat meski tanpa menyalakan audio.
6. **Streaming & Download:** Dilengkapi pemutar video vertikal 9:16 di browser (HTTP Range 206 Partial Content), tombol salin judul cepat, serta opsi unduh satuan atau sekaligus dalam format `.zip`.

---

## ✨ Fitur Utama

- ⚡ **Background Worker (Non-blocking):** Pemrosesan video berjalan di background thread pool dengan progress real-time (0–100%) sehingga web tidak mengalami *request timeout*.
- 🤖 **Kecerdasan Buatan Gemini AI:** Menggunakan model canggih `gemini-3.5-flash` untuk transkripsi multi-bahasa (Indonesia, English, dll.) dan pemilihan segmen ber-hook kuat.
- 📱 **Desain Khusus Shorts/Reels/TikTok:** Output video vertikal 9:16 dengan teks subtitle berukuran besar dan kontras tinggi yang mudah dibaca di layar HP.
- 🎬 **Video Preview Responsif:** Preview video vertikal langsung di browser dengan dukungan seeking cepat sebelum diunduh.
- 📦 **Download Paket ZIP:** Unduh semua klip hasil kurasi hanya dengan satu klik.
- 📝 **Transkrip Interaktif:** Navigasi dialog lengkap dengan pencarian kata kunci dan salin seluruh teks transkrip.
- 🕒 **Riwayat Browser Lokal:** Menyimpan daftar job yang pernah dibuat di browser Anda tanpa perlu repot login akun.
- 🧹 **Auto Cleanup 24 Jam:** Task latar belakang membersihkan file upload dan hasil render yang lebih tua dari 24 jam untuk menghemat disk server.
- 🌓 **Tema Gelap Elegan:** Antarmuka responsif mobile-friendly dibangun dengan Next.js App Router dan Tailwind CSS.

---

## 🏗️ Arsitektur & Teknologi

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons | Antarmuka pengguna responsif bertema gelap |
| **Backend API** | FastAPI, Python 3.12+, SQLite | REST API, streaming parsial, dan antrean job |
| **Worker Engine** | `ThreadPoolExecutor` | Eksekusi asinkron pemrosesan video di background |
| **AI Processing** | Google GenAI SDK (`gemini-3.5-flash`) | Transkripsi audio bertimestamp & kurasi klip viral |
| **Video Engine** | FFmpeg & libass | Cropping 9:16, scaling 1080x1920, subtitle rendering |
| **Container** | Docker & Docker Compose | Multi-container setup siap produksi |

---

## 📁 Struktur Folder Proyek

```
swift-studio/
├── backend/
│   ├── main.py            # REST API FastAPI (upload, streaming, download, cleanup)
│   ├── jobs.py            # SQLite database & thread pool background worker
│   ├── pipeline.py        # Ekstraksi audio, Gemini AI, subtitle ASS, & FFmpeg render
│   ├── test_api.py        # Pengujian otomatis seluruh endpoint backend
│   ├── requirements.txt   # Dependensi Python backend
│   ├── Dockerfile         # Docker container backend (dengan FFmpeg & font ASS)
│   ├── bin/               # Eksekusi biner FFmpeg lokal (opsional)
│   └── storage/
│       ├── uploads/       # Direktori penyimpanan video upload
│       └── outputs/       # Direktori hasil klip & transkrip per job
├── frontend/
│   ├── src/
│   │   ├── app/           # Halaman Next.js (/, /jobs/[id], /history)
│   │   ├── components/    # Dropzone, ClipCard, TranscriptTab, Navbar, Footer
│   │   └── lib/           # API client helper & localStorage storage
│   ├── Dockerfile         # Docker container frontend Next.js
│   └── package.json
├── docker-compose.yml     # Orkestrasi backend & frontend
├── run.bat                # Launcher 1-klik untuk Windows
├── run.ps1                # Launcher 1-klik untuk PowerShell
└── README.md
```

---

## 🚀 Panduan Menjalankan

### Persyaratan Awal:
1. **Python 3.11+** dan **Node.js 18+**
2. **API Key Gemini** (Dapatkan secara gratis di [Google AI Studio](https://aistudio.google.com/))
3. **FFmpeg** terpasang di sistem atau gunakan Docker.

---

### 1. Menjalankan Cepat (Windows)

Cukup klik ganda berkas **`run.bat`** atau jalankan script PowerShell berikut:
```powershell
.\run.ps1
```
Script ini akan otomatis mengaktifkan server backend di port `8000`, frontend di port `3000`, dan membuka peramban di `http://localhost:3000`.

---

### 2. Menjalankan Manual (2 Terminal)

#### **Terminal 1: Backend (FastAPI)**
```bash
cd backend

# Buat dan aktifkan virtual environment
python -m venv .venv
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate # Linux / macOS

# Install dependensi
pip install -r requirements.txt

# Buat file .env dari template
cp .env.example .env
```

Pastikan berkas `backend/.env` berisi:
```env
GEMINI_API_KEY=isi_api_key_anda
GEMINI_MODEL=gemini-3.5-flash
MAX_UPLOAD_MB=2048
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Jalankan server backend:
```bash
uvicorn main:app --reload --port 8000
```
> Server backend aktif di `http://localhost:8000` (Dokumentasi Swagger di `http://localhost:8000/docs`).

#### **Terminal 2: Frontend (Next.js)**
```bash
cd frontend

# Install dependensi
npm install

# Jalankan server development
npm run dev
```
> Buka browser di: **`http://localhost:3000`**

---

### 3. Menjalankan Menggunakan Docker Compose

Jika ingin menjalankan tanpa menginstal Python atau FFmpeg di komputer host:

1. Buat berkas `.env` di folder utama:
   ```env
   GEMINI_API_KEY=isi_api_key_anda
   GEMINI_MODEL=gemini-3.5-flash
   ```
2. Jalankan:
   ```bash
   docker-compose up --build
   ```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

---

## 🔒 Keamanan & Kebijakan Hak Cipta
- API key Gemini sepenuhnya diamankan di sisi server backend (`.env`) dan tidak pernah dikirim ke browser frontend.
- Swift Studio mewajibkan pengguna mencentang konfirmasi hak cipta sebelum mengunggah video.
- Tidak menyediakan fitur download ilegal dari URL YouTube guna mematuhi *Terms of Service*.

---

## 📄 Lisensi
Didistribusikan di bawah lisensi **MIT**. Bebas dimodifikasi dan dikembangkan untuk kebutuhan pribadi maupun komersial.
