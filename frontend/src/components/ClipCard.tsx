"use client";

import React, { useState } from "react";
import {
  Download,
  Copy,
  Check,
  Flame,
  Clock,
  Sparkles,
  Sliders,
} from "lucide-react";
import { ClipItem, getClipDownloadUrl, getClipStreamUrl } from "@/lib/api";

interface ClipCardProps {
  jobId: string;
  clip: ClipItem;
  onOpenRerender?: (clip: ClipItem) => void;
}

export default function ClipCard({
  jobId,
  clip,
  onOpenRerender,
}: ClipCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(clip.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const streamUrl = getClipStreamUrl(jobId, clip.index);
  const downloadUrl = getClipDownloadUrl(jobId, clip.index);

  // Score styling
  const getScoreBadgeColor = (score: number) => {
    if (score >= 8) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (score >= 6) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
    return "bg-zinc-800 text-zinc-300 border-zinc-700";
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/60 shadow-xl transition-all duration-300 hover:border-zinc-700 hover:shadow-2xl hover:shadow-orange-500/5">
      {/* 9:16 Video Player Container */}
      <div className="relative aspect-[9/16] w-full bg-black overflow-hidden flex items-center justify-center">
        <video
          src={streamUrl}
          controls
          preload="metadata"
          className="h-full w-full object-contain"
        />

        {/* Viral Score Badge Floating */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-md z-10 shadow-lg pointer-events-none transition-transform group-hover:scale-105">
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 border ${getScoreBadgeColor(
              clip.score
            )}`}
          >
            <Flame className="h-3.5 w-3.5 fill-current" />
            <span>Skor {clip.score}/10</span>
          </div>
        </div>

        {/* Duration Badge Floating */}
        <div className="absolute top-3 right-3 rounded-md bg-black/70 border border-white/10 px-2 py-1 text-[11px] font-mono text-zinc-200 backdrop-blur-md z-10">
          {clip.duration > 0 ? `${clip.duration}s` : `${clip.start}-${clip.end}`}
        </div>
      </div>

      {/* Info Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Title & Copy Action */}
        <div className="flex items-start justify-between gap-2">
          <h4
            className="text-sm font-semibold text-white line-clamp-2 leading-snug"
            title={clip.title}
          >
            {clip.title}
          </h4>
          <button
            type="button"
            onClick={handleCopyTitle}
            className={`shrink-0 rounded-lg p-1.5 transition-colors ${
              copied
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Salin Judul"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Timestamps */}
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Clock className="h-3.5 w-3.5 text-zinc-500" />
          <span>
            {clip.start} — {clip.end}
          </span>
        </div>

        {/* Viral Reason */}
        {clip.reason && (
          <p className="mt-2.5 text-xs text-zinc-400 line-clamp-2 bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-2 flex items-start gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{clip.reason}</span>
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2 pt-2 border-t border-zinc-800/60">
          <a
            href={downloadUrl}
            download={clip.file_name}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600/90 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-orange-500 shadow-md shadow-orange-600/20 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>

          {onOpenRerender && (
            <button
              type="button"
              onClick={() => onOpenRerender(clip)}
              className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 p-2 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              title="Edit klip atau render ulang"
            >
              <Sliders className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
