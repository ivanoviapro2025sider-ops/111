"use client";

import { useEffect, useState } from "react";
import { FileUploader } from "@/components/files/FileUploader";
import { FileList } from "@/components/files/FileList";
import { FilePreview } from "@/components/files/FilePreview";
import type { UploadedFile } from "@/types/file";

export default function FilesPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selected, setSelected] = useState<UploadedFile | null>(null);

  const loadFiles = async () => {
    const response = await fetch("/api/files");
    if (!response.ok) return;
    const data = (await response.json()) as UploadedFile[];
    setFiles(data);
    if (selected) {
      setSelected(data.find((item) => item.id === selected.id) ?? null);
    }
  };

  useEffect(() => {
    void loadFiles();
  }, []);

  return (
    <main className="h-full overflow-y-auto p-6">
      <h1 className="mb-4 text-xl font-semibold">Files</h1>
      <div className="mb-4">
        <FileUploader onUploaded={loadFiles} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <FileList
          files={files}
          onDelete={async (id) => {
            await fetch(`/api/files/${id}`, { method: "DELETE" });
            await loadFiles();
          }}
          onProcess={async (id) => {
            await fetch("/api/files/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileId: id,
                options: {
                  strategy: "map-reduce",
                  chunkSize: 5000,
                  chunkOverlap: 250,
                  maxContextTokens: 12000,
                },
              }),
            });
            await loadFiles();
          }}
          onPreview={setSelected}
        />
        <FilePreview file={selected} />
      </div>
    </main>
  );
}
