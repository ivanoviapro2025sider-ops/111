"use client";

import { useEffect, useState } from "react";
import { FileList } from "@/components/files/FileList";
import { FilePreview } from "@/components/files/FilePreview";
import { FileUploader } from "@/components/files/FileUploader";
import type { FileRecord } from "@/types/file";

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selected, setSelected] = useState<FileRecord | null>(null);

  const loadFiles = async () => {
    const response = await fetch("/api/files");
    const payload = (await response.json()) as FileRecord[];
    setFiles(payload);
  };

  useEffect(() => {
    void loadFiles();
  }, []);

  const processFile = async (id: string) => {
    await fetch("/api/files/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: id,
        strategy: "map-reduce",
        chunkSize: 10000,
        chunkOverlap: 500,
        maxContextTokens: 16000,
      }),
    });
    await loadFiles();
  };

  const deleteFile = async (id: string) => {
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    await loadFiles();
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <FileUploader onUploaded={loadFiles} />
        <FileList files={files} onPreview={setSelected} onDelete={deleteFile} onProcess={processFile} />
      </div>
      <FilePreview file={selected} />
    </div>
  );
}
