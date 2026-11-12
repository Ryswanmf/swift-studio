import React from "react";
import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-zinc-500 text-xs">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-orange-400" />
          <span className="font-semibold text-zinc-300">Swift Studio</span>
          <span>— Generator YouTube Shorts Berbasis Gemini AI</span>
        </div>
        <p className="text-zinc-500">
          Ubah video panjang Anda menjadi konten vertikal 9:16 siap viral.
        </p>
      </div>
    </footer>
  );
}
