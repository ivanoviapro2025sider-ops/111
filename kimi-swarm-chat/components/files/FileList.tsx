import { Trash2 } from "lucide-react";
import { bytesToHuman } from "@/lib/utils";
import type { FileAttachment } from "@/types/file";
import { Button } from "@/components/ui/button";

export function FileList({
  files,
  onDelete,
}: {
  files: FileAttachment[];
  onDelete: (id: string) => Promise<void>;
}) {
  if (!files.length) {
    return <p className="text-sm text-zinc-500">Файлы еще не загружены.</p>;
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/60 p-3"
        >
          <div>
            <p className="text-sm text-zinc-100">{file.name}</p>
            <p className="text-xs text-zinc-500">
              {bytesToHuman(file.size)} • {file.status}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onDelete(file.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
