import { Card } from '@/components/ui/card';

export function FilePreview({ title, content }: { title: string; content?: string | null }) {
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium text-white">{title}</div>
      <pre className="max-h-[360px] whitespace-pre-wrap text-xs text-white/70">{content || 'No preview available.'}</pre>
    </Card>
  );
}
