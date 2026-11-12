"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Video,
  ArrowRight,
} from "lucide-react";
import { JobDetail, deleteJob, getJob } from "@/lib/api";
import { getSavedJobs, removeSavedJob } from "@/lib/storage";

interface HistoryItem {
  id: string;
  filename: string;
  savedAt: string;
  liveDetail?: JobDetail | null;
  loading: boolean;
  error?: string | null;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    const saved = getSavedJobs();
    if (saved.length === 0) {
      setItems([]);
      setIsInitializing(false);
      return;
    }

    const initialItems: HistoryItem[] = saved.map((s) => ({
      id: s.id,
      filename: s.filename,
      savedAt: s.createdAt,
      loading: true,
    }));
    setItems(initialItems);
    setIsInitializing(false);

    // Ambil detail live dari backend secara paralel
    saved.forEach(async (s) => {
      try {
        const detail = await getJob(s.id);
        setItems((prev) =>
          prev.map((item) =>
            item.id === s.id
              ? { ...item, liveDetail: detail, loading: false }
              : item
          )
        );
      } catch (err: unknown) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === s.id
              ? {
                  ...item,
                  loading: false,
                  error:
                    err instanceof Error
                      ? err.message
                      : "Job kadaluarsa/dihapus",
                }
              : item
          )
        );
      }
    });
  }, []);

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Hapus dari localStorage
    removeSavedJob(id);
    setItems((prev) => prev.filter((item) => item.id !== id));

    // Coba hapus juga dari server backend
    try {
      await deleteJob(id);
    } catch {
      // Abaikan jika sudah tidak ada di server
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Clock className="h-6 w-6 text-orange-400" />
            <span>Riwayat Pemrosesan Video</span>
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Daftar job yang pernah Anda buat di browser ini.
          </p>
        </div>

        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 transition-colors shadow-md shadow-orange-600/20"
        >
          <span>+ Buat Klip Baru</span>
        </Link>
      </div>

      {isInitializing ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500 mb-3">
            <Video className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Belum Ada Riwayat Pemrosesan
          </h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
            Video yang Anda unggah dan proses akan muncul di sini agar mudah
            diakses kembali.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/20 hover:opacity-95 transition-opacity"
            >
              <span>Mulai Buat Shorts Pertama</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const detail = item.liveDetail;
            const status = detail ? detail.status : item.loading ? "loading" : "unknown";

            return (
              <div
                key={item.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900 shadow-md"
              >
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                    <Video className="h-5 w-5 text-orange-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white truncate max-w-sm">
                        {item.filename}
                      </h4>

                      {/* Status indicator */}
                      {status === "loading" && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Memeriksa...
                        </span>
                      )}
                      {status === "done" && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {detail?.clips?.length || 0} Klip Selesai
                        </span>
                      )}
                      {(status === "queued" || status === "processing") && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {detail?.progress || 0}%
                        </span>
                      )}
                      {(status === "error" || item.error) && (
                        <span className="flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                          <AlertCircle className="h-3 w-3" />
                          Error / Kadaluarsa
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-zinc-500 font-mono">
                      ID: {item.id} • Disimpan:{" "}
                      {new Date(item.savedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Link
                    href={`/jobs/${item.id}`}
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                  >
                    <span>Buka Job</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    title="Hapus dari riwayat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
