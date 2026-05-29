import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary: "bg-studio-amber text-black hover:bg-amber-400 font-bold",
  secondary: "bg-studio-surface2 text-studio-text hover:bg-studio-surface3 border border-studio-border",
  ghost: "text-studio-muted hover:text-studio-text hover:bg-studio-surface2",
  danger: "bg-studio-red/10 text-studio-red hover:bg-studio-red/20 border border-studio-red/30",
  success: "bg-studio-green/10 text-studio-green hover:bg-studio-green/20 border border-studio-green/30",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
