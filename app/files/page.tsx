'use client';

import React, { useEffect, useState, useCallback } from 'react';
import FileUploader from '@/components/files/FileUploader';
import FileList from '@/components/files/FileList';
import { UploadedFile } from '@/types/file';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FilesPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (e) {
      console.error('Failed to fetch files:', e);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUploadComplete = useCallback(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this file?')) return;
    try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' });
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  }, []);

  const handlePreview = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewFile(data);
      }
    } catch (e) {
      console.error('Failed to fetch file:', e);
    }
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-muted-foreground text-sm">Upload and manage files for agent processing</p>
      </div>

      <FileUploader onUploadComplete={handleUploadComplete} />

      <div className="border rounded-xl p-4">
        <h3 className="text-sm font-medium mb-4">Uploaded Files</h3>
        <FileList
          files={files}
          onDelete={handleDelete}
          onPreview={handlePreview}
        />
      </div>

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewFile?.originalName}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="text-sm space-y-2">
              <div className="text-xs text-muted-foreground">
                Status: {previewFile?.status} | Size: {previewFile?.size ? Math.round(previewFile.size / 1024) + ' KB' : 'N/A'}
              </div>
              {previewFile?.processedText ? (
                <pre className="whitespace-pre-wrap bg-muted rounded-lg p-4 text-xs font-mono">
                  {previewFile.processedText.slice(0, 5000)}
                  {(previewFile.processedText.length || 0) > 5000 && '\n\n... (truncated)'}
                </pre>
              ) : (
                <p className="text-muted-foreground">No processed content available yet.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
