"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-indigo-500 hover:bg-indigo-400 text-white",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100",
  ghost: "bg-transparent hover:bg-zinc-800 text-zinc-200",
  destructive: "bg-red-600 hover:bg-red-500 text-white",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
