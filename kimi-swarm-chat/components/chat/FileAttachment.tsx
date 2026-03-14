import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import type { FileAttachment as Attachment } from "@/types/file";

interface FileAttachmentProps {
  attachment: Attachment;
  onRemove?: (id: string) => void;
}

export function FileAttachment({ attachment, onRemove }: FileAttachmentProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
      <FileText className="h-3.5 w-3.5" />
      <span>{attachment.fileName}</span>
      <span className="text-zinc-500">{formatBytes(attachment.size)}</span>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onRemove(attachment.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
