import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function Switch({ className, label, checked, ...props }: SwitchProps) {
  return (
    <label className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex h-6 w-11 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          {...props}
        />
        <span className="h-6 w-11 rounded-full bg-zinc-700 transition peer-checked:bg-indigo-500" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
      {label ? <span className="text-sm text-zinc-200">{label}</span> : null}
    </label>
  );
}
