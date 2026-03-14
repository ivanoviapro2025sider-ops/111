"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { FileUploader } from "@/components/files/FileUploader";
import { FileList } from "@/components/files/FileList";
import { FilePreview } from "@/components/files/FilePreview";
import type { FileRecord } from "@/types/file";

function normalizeFile(raw: any): FileRecord {
  return {
    ...raw,
    size: Number(raw.size),
    uploadedAt: new Date(raw.uploadedAt).toISOString(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
  };
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selected, setSelected] = useState<FileRecord>();

  const fetchFiles = async () => {
    const response = await fetch("/api/files", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const mapped = data.map(normalizeFile);
    setFiles(mapped);
    if (selected) {
      setSelected(mapped.find((file: FileRecord) => file.id === selected.id));
    }
  };

  useEffect(() => {
    void fetchFiles();
  }, []);

  return (
    <main className="flex h-screen flex-col">
      <Header title="Files" />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-4 p-4">
        <section className="space-y-4 overflow-y-auto">
          <FileUploader onUploaded={fetchFiles} />
          <FileList
            files={files}
            onPreview={(file) => setSelected(file)}
            onDelete={async (id) => {
              await fetch(`/api/files/${id}`, { method: "DELETE" });
              await fetchFiles();
            }}
            onProcess={async (id) => {
              await fetch("/api/files/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileId: id,
                  options: {
                    strategy: "map-reduce",
                    chunkSize: 8000,
                    chunkOverlap: 200,
                    maxContextTokens: 32000,
                  },
                }),
              });
              await fetchFiles();
            }}
          />
        </section>
        <FilePreview file={selected} />
      </div>
    </main>
  );
}
