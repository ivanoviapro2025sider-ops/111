"use client";

import { cn } from "@/lib/utils";

interface TabsListProps {
  tabs: string[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function TabsList({ tabs, value, onValueChange, className }: TabsListProps) {
  return (
    <div className={cn("inline-flex rounded-md border border-zinc-800 p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onValueChange(tab)}
          className={cn(
            "rounded px-3 py-1.5 text-xs transition-colors",
            value === tab
              ? "bg-indigo-500 text-white"
              : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
