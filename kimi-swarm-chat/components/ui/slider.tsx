import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Slider({ className, ...props }: SliderProps) {
  return (
    <input
      type="range"
      className={cn("h-2 w-full cursor-pointer accent-indigo-500", className)}
      {...props}
    />
  );
}
