"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "@/components/files/UploadProgress";

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;

interface FileUploaderProps {
  onUploaded?: () => void;
}

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds)) return "";
  const mins = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${sec}s` : `${sec}s`;
}

export function FileUploader({ onUploaded }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState("");
  const [eta, setEta] = useState("");
  const [error, setError] = useState<string>();

  const supportTus = useMemo(() => Boolean(tus), []);

  const uploadChunked = async (file: File) => {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const startedAt = Date.now();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunk = file.slice(start, end);
      const formData = new FormData();
      formData.set("chunk", chunk);
      formData.set("uploadId", uploadId);
      formData.set("chunkIndex", String(chunkIndex));
      formData.set("totalChunks", String(totalChunks));
      formData.set("fileName", file.name);
      formData.set("mimeType", file.type || "application/octet-stream");
      formData.set("totalSize", String(file.size));

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const uploadedBytes = end;
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const bytesPerSec = uploadedBytes / Math.max(elapsedSec, 1);
      const remainingBytes = file.size - uploadedBytes;
      setProgress((uploadedBytes / file.size) * 100);
      setSpeed(`${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`);
      setEta(formatEta(remainingBytes / Math.max(bytesPerSec, 1)));
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="rounded-lg border border-dashed border-zinc-700 p-6 text-center">
        <p className="text-sm text-zinc-200">
          Drag & Drop files here or click to browse (up to 10 GB)
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          tus-js-client bundled: {supportTus ? "yes" : "no"}; upload endpoint uses chunked HTTP
        </p>
        <div className="mt-4">
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > MAX_FILE_SIZE) {
                setError("File exceeds 10 GB limit.");
                return;
              }
              setUploading(true);
              setError(undefined);
              setProgress(0);
              try {
                await uploadChunked(file);
                onUploaded?.();
              } catch (uploadError) {
                setError(
                  uploadError instanceof Error ? uploadError.message : "Upload failed",
                );
              } finally {
                setUploading(false);
              }
            }}
          />
          <label htmlFor="file-upload">
            <Button type="button" disabled={uploading}>
              <Upload className="mr-1 h-4 w-4" />
              {uploading ? "Uploading..." : "Choose file"}
            </Button>
          </label>
        </div>
      </div>
      {uploading && <UploadProgress percent={progress} speedLabel={speed} etaLabel={eta} />}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
