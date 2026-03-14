"use client";

import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { FileAttachment } from "@/types/file";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "./UploadProgress";

const CHUNK_SIZE = 5 * 1024 * 1024;

interface FileUploaderProps {
  onUploaded: (file: FileAttachment) => void;
}

async function uploadFileInChunks(
  file: File,
  onProgress: (progress: number) => void,
): Promise<FileAttachment> {
  const uploadId = uuidv4();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    const formData = new FormData();
    formData.set("chunk", blob);
    formData.set("uploadId", uploadId);
    formData.set("fileName", file.name);
    formData.set("mimeType", file.type || "application/octet-stream");
    formData.set("totalChunks", String(totalChunks));
    formData.set("chunkIndex", String(chunkIndex));
    formData.set("size", String(file.size));
    formData.set("finalize", String(chunkIndex === totalChunks - 1));

    const response = await fetch("/api/files/upload", { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    onProgress(((chunkIndex + 1) / totalChunks) * 100);

    if (chunkIndex === totalChunks - 1) {
      const payload = (await response.json()) as { file: FileAttachment };
      return payload.file;
    }
  }

  throw new Error("Upload did not finalize.");
}

export function FileUploader({ onUploaded }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const helper = useMemo(
    () =>
      "Supports up to 10 GB per file. Chunk size: 5 MB. Formats: docs, code, media and archives.",
    [],
  );

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6">
      <div className="flex items-center gap-3">
        <UploadCloud className="h-6 w-6 text-indigo-400" />
        <div>
          <p className="text-sm text-zinc-100">Drag & drop files or click to upload</p>
          <p className="text-xs text-zinc-500">{helper}</p>
        </div>
      </div>
      {uploading ? <UploadProgress progress={progress} /> : null}
      <label className="inline-block">
        <input
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            setProgress(0);
            try {
              const uploaded = await uploadFileInChunks(file, setProgress);
              onUploaded(uploaded);
            } finally {
              setUploading(false);
              e.currentTarget.value = "";
            }
          }}
        />
        <Button disabled={uploading}>
          <span>Select file</span>
        </Button>
      </label>
    </div>
  );
}
