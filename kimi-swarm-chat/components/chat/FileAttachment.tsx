import type { FileAttachment as FileAttachmentType } from "@/types/chat";

interface FileAttachmentProps {
  attachment: FileAttachmentType;
}

export function FileAttachment({ attachment }: FileAttachmentProps) {
  return (
    <div className="mt-2 rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">
      📎 {attachment.name} — {(attachment.size / 1024 / 1024).toFixed(2)} MB
    </div>
  );
}
