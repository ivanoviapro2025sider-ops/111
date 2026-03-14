'use client';

import { useEffect, useState } from 'react';
import { UploadedFile } from '@/types/file';
import { FileUploader } from '@/components/files/FileUploader';
import { FileList } from '@/components/files/FileList';
import { FilePreview } from '@/components/files/FilePreview';

export default function FilesPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/settings?type=files');
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const handleUploadComplete = (fileData: unknown) => {
    if (fileData) setFiles((prev) => [fileData as UploadedFile, ...prev]);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  };

  const handleProcess = async (id: string) => {
    try {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'processing' as const } : f))
      );
      const res = await fetch('/api/files/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: id }),
      });
      const data = await res.json();
      if (data.file) {
        setFiles((prev) => prev.map((f) => (f.id === id ? data.file : f)));
      }
    } catch (e) {
      console.error('Failed to process file:', e);
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'error' as const } : f))
      );
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Files</h2>
        <p className="text-muted-foreground text-sm">Upload and manage files for processing</p>
      </div>

      <FileUploader onUploadComplete={handleUploadComplete} />

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Uploaded Files</h3>
        <FileList
          files={files}
          onDelete={handleDelete}
          onProcess={handleProcess}
          onPreview={setPreviewFile}
        />
      </div>

      <FilePreview
        file={previewFile}
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
