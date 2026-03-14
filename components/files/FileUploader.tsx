'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UploadProgress } from '@/components/files/UploadProgress';

const CHUNK_SIZE = 5 * 1024 * 1024;

export function FileUploader({ onUploaded }: { onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const uploadId = crypto.randomUUID();
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const start = chunkIndex * CHUNK_SIZE;
          const chunk = file.slice(start, Math.min(file.size, start + CHUNK_SIZE));
          const body = new FormData();
          body.append('uploadId', uploadId);
          body.append('chunkIndex', String(chunkIndex));
          body.append('totalChunks', String(totalChunks));
          body.append('fileName', file.name);
          body.append('mimeType', file.type || 'application/octet-stream');
          body.append('chunk', chunk);
          const response = await fetch('/api/files/upload', { method: 'POST', body });
          if (!response.ok) throw new Error(`Upload failed for ${file.name}`);
          setProgress((current) => ({ ...current, [file.name]: ((chunkIndex + 1) / totalChunks) * 100 }));
        }
      }
      onUploaded?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-10 text-center" onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }} onDragOver={(event) => event.preventDefault()}>
        <UploadCloud className="mx-auto mb-4 h-10 w-10 text-indigo-300" />
        <div className="text-lg font-medium text-white">Drag & drop files here</div>
        <div className="mt-2 text-sm text-white/45">Chunked upload up to 10 GB per file, with resume-ready server assembly.</div>
        <Button variant="secondary" className="mt-6" onClick={() => inputRef.current?.click()} disabled={busy}>Browse files</Button>
        <input ref={inputRef} type="file" hidden multiple onChange={(event) => void uploadFiles(event.target.files)} />
      </div>
      <div className="mt-4 grid gap-3">{Object.entries(progress).map(([fileName, value]) => <div key={fileName} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="mb-2 text-sm text-white">{fileName}</div><UploadProgress progress={value} /></div>)}</div>
    </Card>
  );
}
