'use client';

import { useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileAttachment } from '@/components/chat/FileAttachment';

export function ChatInput({ onSubmit, disabled }: { onSubmit: (payload: { content: string; attachments: Array<{ id: string; name: string; size: number; type: string }> }) => Promise<void>; disabled?: boolean; }) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; size: number; type: string }>>([]);
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
      {attachments.length ? <div className="mb-3 grid gap-2">{attachments.map((attachment) => <FileAttachment key={attachment.id} attachment={attachment} />)}</div> : null}
      <Textarea placeholder="Сообщение агентам..." value={content} onChange={(event) => setContent(event.target.value)} className="min-h-[110px] border-none bg-transparent px-0 py-0 focus:border-none" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5">
          <Paperclip className="h-4 w-4" />
          Attach files
          <input type="file" hidden multiple onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            const uploaded: Array<{ id: string; name: string; size: number; type: string }> = [];
            for (const file of files) {
              const form = new FormData();
              form.append('uploadId', crypto.randomUUID());
              form.append('chunkIndex', '0');
              form.append('totalChunks', '1');
              form.append('fileName', file.name);
              form.append('mimeType', file.type || 'application/octet-stream');
              form.append('chunk', file);
              const response = await fetch('/api/files/upload', { method: 'POST', body: form });
              const data = await response.json();
              if (data.file) uploaded.push({ id: data.file.id, name: data.file.fileName, size: Number(data.file.size), type: data.file.mimeType });
            }
            setAttachments((current) => [...current, ...uploaded]);
          }} />
        </label>
        <Button disabled={disabled || !content.trim()} onClick={async () => { const payload = { content: content.trim(), attachments }; setContent(''); setAttachments([]); await onSubmit(payload); }}>
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
