import { Badge } from '@/components/ui/badge';

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur xl:px-8">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-white/35">Moonshot AI + OpenRouter</div>
        <div className="text-lg font-semibold text-white">Локальный сервис управления агентами и файлами</div>
      </div>
      <div className="flex items-center gap-3">
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">localhost:3000</Badge>
        <Badge>SQLite + Prisma</Badge>
      </div>
    </header>
  );
}
