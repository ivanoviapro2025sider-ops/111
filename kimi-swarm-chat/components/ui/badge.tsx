import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
