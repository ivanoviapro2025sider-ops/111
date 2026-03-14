'use client';

import React, { useEffect, useState, useCallback } from 'react';
import FileUploader from '@/components/files/FileUploader';
import FileList from '@/components/files/FileList';
import type { UploadedFile } from '@/types/file';

export default function FilesPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    // Fetch all files by listing from settings/files endpoint
    // For now, we'll use a simple approach
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (selectedFiles: File[]) => {
    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const uploaded = await res.json();
          setFiles((prev) => [
            {
              id: uploaded.id,
              filename: uploaded.filename,
              originalName: uploaded.originalName || file.name,
              mimeType: uploaded.mimeType || file.type,
              size: uploaded.size || file.size,
              path: uploaded.path || '',
              status: uploaded.status || 'processed',
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'processing' as const } : f))
      );
      const res = await fetch('/api/files/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: id }),
      });
      if (res.ok) {
        const updated = await res.json();
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: updated.status } : f))
        );
      }
    } catch (error) {
      console.error('Reprocess failed:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-muted-foreground">Upload and manage files for your agents to process</p>
      </div>

      <div className="space-y-6">
        <FileUploader onUpload={handleUpload} />
        <FileList files={files} onDelete={handleDelete} onReprocess={handleReprocess} />
      </div>
    </div>
  );
}
