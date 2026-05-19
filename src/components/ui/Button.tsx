"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses = {
  gold:    "bg-[#D94040] text-white font-semibold hover:bg-[#C03030] active:bg-[#A82020] disabled:opacity-50",
  outline: "border border-[#D94040] text-[#D94040] hover:bg-[#D94040]/10 active:bg-[#D94040]/20 disabled:opacity-50",
  ghost:   "text-[#9A7A78] hover:text-[#1E0E0B] hover:bg-[rgba(217,64,64,0.06)] active:bg-[rgba(217,64,64,0.1)] disabled:opacity-50",
  danger:  "bg-[#E74C3C] text-white font-semibold hover:bg-[#c0392b] active:bg-[#a93226] disabled:opacity-50",
};

const sizeClasses = {
  sm: "h-9  px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-6 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "gold", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[8px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D94040] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5EDED] cursor-pointer select-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };
