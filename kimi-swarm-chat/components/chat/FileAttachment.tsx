import { Paperclip } from "lucide-react";
import { bytesToHuman } from "@/lib/utils";
import type { FileAttachment as FileAttachmentType } from "@/types/file";

export function FileAttachment({ file }: { file: FileAttachmentType }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
      <Paperclip className="h-3 w-3" />
      <span className="truncate">{file.name}</span>
      <span className="text-zinc-500">{bytesToHuman(file.size)}</span>
    </div>
  );
}
