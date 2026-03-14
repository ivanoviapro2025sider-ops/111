import { Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatBytes } from '@/lib/utils';

export function FileAttachment({ attachment }: { attachment: { name: string; size: number; type: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
      <Paperclip className="h-3.5 w-3.5" />
      <span className="truncate">{attachment.name}</span>
      <Badge className="ml-auto">{formatBytes(attachment.size)}</Badge>
    </div>
  );
}
