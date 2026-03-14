'use client';

import { useEffect, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import type { UploadedFileRecord } from '@/types/file';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilePreview } from '@/components/files/FilePreview';
import { formatBytes } from '@/lib/utils';

export function FileList() {
  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [selected, setSelected] = useState<UploadedFileRecord | null>(null);
  const loadFiles = async () => {
    const response = await fetch('/api/files/process', { cache: 'no-store' });
    const data = await response.json();
    setFiles(data.files ?? []);
  };
  useEffect(() => { void loadFiles(); }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
      <Card className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-white">Uploaded files</div>
        <div className="divide-y divide-white/5">
          {files.map((file) => <div key={file.id} className="flex items-center gap-3 px-4 py-4 text-sm text-white/80"><div className="min-w-0 flex-1"><div className="truncate text-white">{file.fileName}</div><div className="text-xs text-white/40">{formatBytes(Number(file.size))} - {file.mimeType}</div></div><Badge>{file.status}</Badge><Button variant="ghost" size="sm" onClick={() => setSelected(file)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={async () => { await fetch(`/api/files/${file.id}`, { method: 'DELETE' }); if (selected?.id === file.id) setSelected(null); await loadFiles(); }}><Trash2 className="h-4 w-4" /></Button></div>)}
          {!files.length ? <div className="px-4 py-10 text-sm text-white/45">No files uploaded yet.</div> : null}
        </div>
      </Card>
      <FilePreview title={selected?.fileName ?? 'Preview'} content={selected?.summary ?? selected?.extractedText} />
    </div>
  );
}
