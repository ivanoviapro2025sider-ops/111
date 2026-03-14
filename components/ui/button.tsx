import * as React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-indigo-500 text-white hover:bg-indigo-400',
  secondary: 'bg-white/5 text-white hover:bg-white/10 border border-white/10',
  ghost: 'text-white/80 hover:bg-white/5 hover:text-white',
  danger: 'bg-red-500 text-white hover:bg-red-400',
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
