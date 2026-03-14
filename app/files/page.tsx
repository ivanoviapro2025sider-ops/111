'use client';

import { FileList } from '@/components/files/FileList';
import { FileUploader } from '@/components/files/FileUploader';

export default function FilesPage() {
  return (
    <div className="space-y-6">
      <div><div className="text-xs uppercase tracking-[0.2em] text-white/35">Uploads</div><h2 className="text-3xl font-semibold text-white">Файловый менеджер</h2></div>
      <FileUploader />
      <FileList />
    </div>
  );
}
