"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileVideo, X, CheckCircle2 } from "lucide-react";

interface DropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  isUploading: boolean;
  uploadProgress: number;
}

const ACCEPTED_EXTENSIONS = [".mp4", ".mov", ".mkv", ".webm"];

export default function Dropzone({
  onFileSelect,
  selectedFile,
  isUploading,
  uploadProgress,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrorMessage(
        `Format '${ext}' tidak didukung. Harap pilih video (${ACCEPTED_EXTENSIONS.join(
          ", "
        )}).`
      );
      return;
    }

    // Limit check: 2GB
    if (file.size > 2048 * 1024 * 1024) {
      setErrorMessage("Ukuran file melebihi batas 2 GB.");
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUploading) return;
    onFileSelect(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    }
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={handleInputChange}
        disabled={isUploading}
        className="hidden"
      />

      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all sm:p-8 ${
          isDragOver
            ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10 scale-[1.01]"
            : selectedFile
            ? "border-zinc-700 bg-zinc-900/60 hover:border-zinc-600"
            : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
        } ${isUploading ? "cursor-not-allowed opacity-90" : ""}`}
      >
        {selectedFile ? (
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <FileVideo className="h-7 w-7" />
            </div>

            <div className="flex items-center gap-2 max-w-full">
              <span className="truncate text-base font-semibold text-white">
                {selectedFile.name}
              </span>
              {!isUploading && (
                <button
                  type="button"
                  onClick={removeFile}
                  className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                  title="Hapus file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="mt-1 text-xs text-zinc-400">
              {formatFileSize(selectedFile.size)} • Siap diproses
            </p>

            {isUploading && (
              <div className="mt-5 w-full">
                <div className="flex justify-between text-xs text-zinc-400 mb-1.5 font-medium">
                  <span>Mengunggah video ke server...</span>
                  <span className="text-orange-400 font-bold">{uploadProgress}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-400 group-hover:scale-105 transition-transform">
              <UploadCloud className="h-7 w-7 text-orange-400" />
            </div>

            <h3 className="text-base font-semibold text-zinc-200">
              Seret dan lepaskan video ke sini, atau{" "}
              <span className="text-orange-400 underline underline-offset-4">
                telusuri file
              </span>
            </h3>

            <p className="mt-1.5 text-xs text-zinc-500">
              Mendukung MP4, MOV, MKV, WebM (Maksimal 2 GB)
            </p>

            <div className="mt-4 flex items-center gap-4 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Format Vertikal 9:16
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Auto Caption Terbakar
              </span>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="mt-2 text-center text-xs font-medium text-rose-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
