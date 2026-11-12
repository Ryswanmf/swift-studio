"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Sliders,
  Subtitles,
  Globe2,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { uploadAndCreateJob } from "@/lib/api";
import { saveJobId } from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [numClips, setNumClips] = useState<number>(6);
  const [burnCaptions, setBurnCaptions] = useState<boolean>(true);
  const [language, setLanguage] = useState<string>("Indonesia");
  const [copyrightAgreed, setCopyrightAgreed] = useState<boolean>(false);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !copyrightAgreed || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const result = await uploadAndCreateJob(
        selectedFile,
        {
          numClips,
          burnCaptions,
          language,
        },
        (progress) => setUploadProgress(progress)
      );

      // Simpan ke riwayat browser
      saveJobId(result.job_id, selectedFile.name);

      // Arahkan ke halaman status job
      router.push(`/jobs/${result.job_id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memproses video.";
      setErrorMessage(msg);
      setIsUploading(false);
    }
  };

  const isSubmitDisabled = !selectedFile || !copyrightAgreed || isUploading;

  return (
    <div className="relative isolate px-4 py-12 sm:px-6 lg:px-8">
      {/* Background glow effects */}
      <div
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-amber-600/30 to-orange-500/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="mx-auto max-w-3xl">
        {/* Hero Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Didukung Gemini API & FFmpeg Engine</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ubah Video Panjang Jadi{" "}
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Shorts 9:16
            </span>{" "}
            dalam Menit
          </h1>

          <p className="mt-4 text-sm text-zinc-400 sm:text-base leading-relaxed max-w-2xl mx-auto">
            Unggah video horizontal Anda. AI akan menemukan momen paling viral,
            memotong klip vertikal &le;60 detik, dan membakar caption otomatis
            siap tayang di YouTube Shorts.
          </p>
        </div>

        {/* Upload Form Card */}
        <form
          onSubmit={handleStartProcessing}
          className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          {/* Dropzone */}
          <Dropzone
            onFileSelect={(file) => setSelectedFile(file)}
            selectedFile={selectedFile}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />

          {/* Settings Options Grid */}
          <div className="mt-8 space-y-6 border-t border-zinc-800/80 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-orange-400" />
              <span>Pengaturan Klip</span>
            </h3>

            {/* Slider Jumlah Klip */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-200">
                  Target Jumlah Klip
                </label>
                <span className="rounded-md bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 font-mono text-xs font-bold text-orange-400">
                  {numClips} Klip
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={numClips}
                onChange={(e) => setNumClips(parseInt(e.target.value, 10))}
                disabled={isUploading}
                className="w-full accent-orange-500 cursor-pointer h-2 rounded-lg bg-zinc-800"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                <span>1 Klip</span>
                <span>5 Klip</span>
                <span>10 Klip</span>
              </div>
            </div>

            {/* Grid 2 Opsi: Caption & Bahasa */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Toggle Bakar Caption */}
              <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                    <Subtitles className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      Bakar Caption ke Video
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Subtitle closed caption tercetak permanen
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={burnCaptions}
                    onChange={(e) => setBurnCaptions(e.target.checked)}
                    disabled={isUploading}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {/* Pilihan Bahasa */}
              <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                    <Globe2 className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      Bahasa Audio
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Bahasa transkripsi dialog
                    </p>
                  </div>
                </div>

                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isUploading}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="Indonesia">Indonesia</option>
                  <option value="English">English</option>
                  <option value="Jawa">Jawa</option>
                  <option value="Sunda">Sunda</option>
                </select>
              </div>
            </div>

            {/* Checkbox Hak Cipta Wajib */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={copyrightAgreed}
                  onChange={(e) => setCopyrightAgreed(e.target.checked)}
                  disabled={isUploading}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 text-orange-600 accent-orange-600"
                />
                <div className="text-xs leading-relaxed text-zinc-300">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Pernyataan Hak Cipta (Wajib):
                  </span>
                  Saya memiliki hak atas video ini atau sudah mendapat izin
                  resmi untuk memproses dan memotong kontennya.
                </div>
              </label>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">Gagal memulai pemrosesan:</p>
                <p className="mt-0.5 text-rose-200">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Tombol Buat Klip */}
          <div className="mt-8">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 text-sm font-bold text-white transition-all duration-200 ${
                isSubmitDisabled
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:opacity-95 shadow-lg shadow-orange-500/25 active:scale-[0.99]"
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengunggah Video ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 fill-current" />
                  <span>Buat Klip Shorts Sekarang</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-500">
              Pemrosesan berjalan di server background. Anda akan diarahkan ke
              halaman status untuk memantau progress secara real-time.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
