"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Switch({ className, checked, ...props }: SwitchProps) {
  return (
    <label className={cn("relative inline-flex cursor-pointer items-center", className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} {...props} />
      <span className="h-6 w-11 rounded-full bg-zinc-700 transition-colors peer-checked:bg-indigo-500" />
      <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </label>
  );
}
