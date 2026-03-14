"use client";

import { useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { UploadProgress } from "@/components/files/UploadProgress";

const CHUNK_SIZE = 5 * 1024 * 1024;

interface FileUploaderProps {
  onUploaded: () => Promise<void> | void;
}

export function FileUploader({ onUploaded }: FileUploaderProps) {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = async (file: File) => {
    const uploadId = uuid();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const payload = new FormData();
      payload.append("uploadId", uploadId);
      payload.append("fileName", file.name);
      payload.append("mimeType", file.type || "application/octet-stream");
      payload.append("chunkIndex", String(chunkIndex));
      payload.append("totalChunks", String(totalChunks));
      payload.append("totalSize", String(file.size));
      payload.append("chunk", chunk);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const uploaded = ((chunkIndex + 1) / totalChunks) * 100;
      setProgress((state) => ({
        ...state,
        [file.name]: uploaded,
      }));
    }

    setProgress((state) => ({ ...state, [file.name]: 100 }));
    await onUploaded();
  };

  return (
    <section className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          for (const file of files) {
            await uploadFile(file);
          }
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-lg border border-zinc-700 px-4 py-10 text-center text-zinc-300 hover:border-indigo-500"
      >
        📂 Drag & Drop or click to browse (up to 10 GB)
      </button>
      <div className="mt-4 space-y-2">
        {Object.entries(progress).map(([name, value]) => (
          <div key={name} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
            <p className="mb-1 text-xs text-zinc-300">{name}</p>
            <UploadProgress progress={Math.min(100, value)} />
          </div>
        ))}
      </div>
    </section>
  );
}
