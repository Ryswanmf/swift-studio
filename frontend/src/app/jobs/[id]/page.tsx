"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Film,
  FileText,
  RotateCw,
  ArrowLeft,
} from "lucide-react";
import {
  ClipItem,
  JobDetail,
  getDownloadAllZipUrl,
  getJob,
} from "@/lib/api";
import ClipCard from "@/components/ClipCard";
import TranscriptTab from "@/components/TranscriptTab";
import RerenderModal from "@/components/RerenderModal";

export default function JobDetailPage() {
  const routeParams = useParams();
  const jobId = Array.isArray(routeParams?.id)
    ? routeParams.id[0]
    : (routeParams?.id as string) || "";

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pollError, setPollError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"clips" | "transcript">("clips");

  // Modal Rerender
  const [selectedClipForRerender, setSelectedClipForRerender] =
    useState<ClipItem | null>(null);

  const fetchJobData = useCallback(async () => {
    try {
      const data = await getJob(jobId);
      setJob(data);
      setPollError(null);
      return data;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal memuat status job.";
      setPollError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const poll = async () => {
      const currentJob = await fetchJobData();
      if (!isMounted) return;

      // Terus polling jika status queued atau processing
      if (
        currentJob &&
        (currentJob.status === "queued" || currentJob.status === "processing")
      ) {
        timer = setTimeout(poll, 2000);
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [fetchJobData]);

  const handleClipRerenderSuccess = (updatedClip: ClipItem) => {
    if (!job) return;
    const updatedClips = job.clips.map((c) =>
      c.index === updatedClip.index ? updatedClip : c
    );
    setJob({ ...job, clips: updatedClips });
  };

  // State: Loading awal
  if (loading && !job) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500 mb-4" />
        <h2 className="text-lg font-semibold text-white">Memuat Data Job...</h2>
        <p className="mt-1 text-xs text-zinc-400 font-mono">ID: {jobId}</p>
      </div>
    );
  }

  // State: Error tidak ditemukan / koneksi gagal
  if (pollError && !job) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Job Tidak Ditemukan</h2>
        <p className="mt-2 text-sm text-zinc-400">{pollError}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchJobData();
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <RotateCw className="h-4 w-4" />
            <span>Coba Lagi</span>
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const isProcessing = job.status === "queued" || job.status === "processing";
  const isDone = job.status === "done";
  const isError = job.status === "error";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Top Navigation & Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Kembali ke Beranda"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white truncate max-w-md">
                {job.filename}
              </h1>
              {/* Status Badge */}
              {isProcessing && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Memproses</span>
                </span>
              )}
              {isDone && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Selesai</span>
                </span>
              )}
              {isError && (
                <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-medium text-rose-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>Gagal</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              ID: {job.id} • Dibuat: {new Date(job.created_at).toLocaleTimeString("id-ID")}
            </p>
          </div>
        </div>

        {/* Action Header Buttons */}
        {isDone && (
          <div className="flex items-center gap-2.5">
            <a
              href={getDownloadAllZipUrl(job.id)}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-500 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download Semua ({job.clips.length} Klip ZIP)</span>
            </a>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <span>+ Buat Baru</span>
            </Link>
          </div>
        )}
      </div>

      {/* Processing State: Live Progress Bar & Status */}
      {isProcessing && (
        <div className="my-10 mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500/10 border border-orange-500/20 text-orange-400 mb-6">
            <Loader2 className="h-10 w-10 animate-spin" />
            <div className="absolute inset-0 rounded-3xl animate-ping opacity-15 bg-orange-500" />
          </div>

          <h2 className="text-xl font-bold text-white">
            Sedang Membuat Klip Shorts...
          </h2>
          <p className="mt-1 text-sm text-orange-400 font-medium">
            {job.message || "Memproses..."}
          </p>

          {/* Progress Bar */}
          <div className="mt-6 w-full">
            <div className="flex justify-between text-xs text-zinc-400 mb-2 font-mono">
              <span>Kemajuan Sistem</span>
              <span className="font-bold text-white">{job.progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800 p-0.5 border border-zinc-700/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(job.progress, 5)}%` }}
              />
            </div>
          </div>

          {/* Steps Explanation */}
          <div className="mt-8 grid grid-cols-2 gap-3 text-left sm:grid-cols-4 text-[11px] text-zinc-400">
            <div
              className={`rounded-xl border p-2.5 ${
                job.progress >= 15
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              1. Ekstrak Audio
            </div>
            <div
              className={`rounded-xl border p-2.5 ${
                job.progress >= 35
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              2. Gemini AI Transkrip
            </div>
            <div
              className={`rounded-xl border p-2.5 ${
                job.progress >= 55
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              3. Kurasi Klip Viral
            </div>
            <div
              className={`rounded-xl border p-2.5 ${
                job.progress >= 95
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              4. Render Subtitle 9:16
            </div>
          </div>

          <p className="mt-6 text-xs text-zinc-500">
            Halaman ini otomatis diperbarui setiap 2 detik. Jangan tutup browser
            jika ingin memantau langsung.
          </p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="my-8 mx-auto max-w-2xl rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 mb-4 border border-rose-500/30">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Pemrosesan Video Terhenti
          </h2>
          <p className="mt-2 text-sm text-rose-200">
            {job.error || "Terjadi kesalahan internal pada server pipeline."}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setLoading(true);
                fetchJobData();
              }}
              className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
            >
              <RotateCw className="h-4 w-4" />
              <span>Cek Status Ulang</span>
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Upload Video Lain</span>
            </Link>
          </div>
        </div>
      )}

      {/* Done State: Clips Grid & Tabs */}
      {isDone && (
        <div>
          {/* Navigation Tabs */}
          <div className="mb-6 flex items-center justify-between border-b border-zinc-800">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setActiveTab("clips")}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === "clips"
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                <Film className="h-4 w-4" />
                <span>Klip Shorts ({job.clips.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("transcript")}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === "transcript"
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Transkrip Video ({job.transcript.length})</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Clips 9:16 Grid */}
          {activeTab === "clips" && (
            <div>
              {job.clips.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">
                  <Film className="mx-auto h-12 w-12 text-zinc-600 mb-2" />
                  <p>Tidak ada klip yang berhasil dihasilkan dari video ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
                  {job.clips.map((clip) => (
                    <ClipCard
                      key={clip.index}
                      jobId={job.id}
                      clip={clip}
                      onOpenRerender={(c) => setSelectedClipForRerender(c)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Transcript Viewer */}
          {activeTab === "transcript" && (
            <TranscriptTab transcript={job.transcript} />
          )}
        </div>
      )}

      {/* Rerender Modal (Tahap 2) */}
      {selectedClipForRerender && (
        <RerenderModal
          jobId={job.id}
          clip={selectedClipForRerender}
          isOpen={!!selectedClipForRerender}
          onClose={() => setSelectedClipForRerender(null)}
          onSuccess={handleClipRerenderSuccess}
        />
      )}
    </div>
  );
}
