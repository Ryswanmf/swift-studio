"use client";

import React, { useState } from "react";
import { Search, Copy, Check, FileText } from "lucide-react";
import { TranscriptSegment } from "@/lib/api";

interface TranscriptTabProps {
  transcript: TranscriptSegment[];
}

export default function TranscriptTab({ transcript }: TranscriptTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = transcript.filter((seg) =>
    seg.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyAll = async () => {
    try {
      const fullText = transcript
        .map((s) => `[${s.start} - ${s.end}] ${s.text}`)
        .join("\n");
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-orange-400" />
          <h3 className="text-base font-semibold text-white">
            Transkrip Dialog Video
          </h3>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 font-mono">
            {transcript.length} segmen
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari kata dalam transkrip..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 w-48 sm:w-64"
            />
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              copied
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Semua</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Transcript Items List */}
      <div className="mt-4 max-h-[500px] overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">
            {searchTerm
              ? "Tidak ditemukan dialog yang cocok dengan pencarian."
              : "Transkrip belum tersedia."}
          </p>
        ) : (
          filtered.map((seg, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-3 rounded-xl p-2.5 hover:bg-zinc-800/40 transition-colors border border-transparent hover:border-zinc-800/60"
            >
              <span className="shrink-0 rounded-md bg-zinc-950 px-2 py-1 font-mono text-[11px] text-orange-400 border border-zinc-800/80">
                {seg.start} - {seg.end}
              </span>
              <p className="text-sm text-zinc-200 leading-relaxed pt-0.5">
                {seg.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
