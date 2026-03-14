"use client";

import { useEffect, useMemo, useState } from "react";
import { FileList } from "@/components/files/FileList";
import { FilePreview } from "@/components/files/FilePreview";
import { FileUploader } from "@/components/files/FileUploader";
import { Button } from "@/components/ui/button";
import type { FileAttachment } from "@/types/file";

export default function FilesPage() {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  async function loadFiles() {
    const response = await fetch("/api/files");
    if (!response.ok) return;
    const payload = (await response.json()) as { data: FileAttachment[] };
    setFiles(payload.data || []);
  }

  useEffect(() => {
    void loadFiles();
  }, []);

  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId) || null,
    [files, selectedFileId],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <FileUploader
          onUploaded={(file) => {
            setFiles((prev) => [file, ...prev]);
          }}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Uploaded files</h3>
            <Button variant="secondary" size="sm" onClick={() => void loadFiles()}>
              Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                className="w-full text-left"
                onClick={() => setSelectedFileId(file.id)}
              >
                <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2 text-xs text-zinc-300 hover:border-zinc-700">
                  {file.name}
                </div>
              </button>
            ))}
          </div>
          <FileList
            files={files}
            onDelete={async (id) => {
              await fetch(`/api/files/${id}`, { method: "DELETE" });
              await loadFiles();
              if (selectedFileId === id) setSelectedFileId(null);
            }}
          />
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-100">Preview / Processing</h3>
        <FilePreview file={selectedFile} />
        {selectedFile ? (
          <Button
            className="w-full"
            onClick={async () => {
              await fetch("/api/files/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileId: selectedFile.id,
                  options: { strategy: "map-reduce", chunkSize: 8000, chunkOverlap: 300 },
                }),
              });
              await loadFiles();
            }}
          >
            Process with agent pipeline
          </Button>
        ) : null}
      </section>
    </div>
  );
}
