"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "@/components/files/UploadProgress";

const CHUNK_SIZE = 5 * 1024 * 1024;

interface FileUploaderProps {
  onUploaded: () => Promise<void> | void;
}

async function uploadSingleFile(
  file: File,
  onProgress: (progress: number, speedMbps: number, etaSeconds: number) => void,
) {
  const uploadId = `${file.name}-${file.size}-${file.lastModified}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const startedAt = Date.now();

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append("uploadId", uploadId);
    formData.append("fileName", file.name);
    formData.append("mimeType", file.type || "application/octet-stream");
    formData.append("totalSize", String(file.size));
    formData.append("totalChunks", String(totalChunks));
    formData.append("chunkIndex", String(chunkIndex));
    formData.append("chunk", chunk);

    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Chunk ${chunkIndex + 1} upload failed`);
    }

    const uploaded = end;
    const elapsedSec = Math.max(1, (Date.now() - startedAt) / 1000);
    const speed = uploaded / 1024 / 1024 / elapsedSec;
    const remaining = file.size - uploaded;
    const eta = remaining / (speed * 1024 * 1024);
    onProgress((uploaded / file.size) * 100, speed, eta);
  }
}

export function FileUploader({ onUploaded }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        await uploadSingleFile(file, (p, s, e) => {
          setProgress(p);
          setSpeed(s);
          setEta(e);
        });
      }
      await onUploaded();
    } finally {
      setUploading(false);
      setProgress(0);
      setSpeed(0);
      setEta(0);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files || []);
        void handleFiles(files);
      }}
      className={`rounded-xl border border-dashed p-6 text-center ${
        dragging ? "border-indigo-400 bg-indigo-500/10" : "border-zinc-700 bg-zinc-900/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          void handleFiles(files);
        }}
      />

      <Upload className="mx-auto mb-3 h-6 w-6 text-zinc-300" />
      <p className="text-sm text-zinc-200">Drag & Drop files here or click to browse</p>
      <p className="mt-1 text-xs text-zinc-500">Supports chunked uploads up to 10 GB</p>
      <Button className="mt-4" variant="outline" onClick={() => inputRef.current?.click()}>
        Choose Files
      </Button>

      {uploading ? <UploadProgress progress={progress} speedMbps={speed} etaSeconds={eta} /> : null}
    </div>
  );
}
