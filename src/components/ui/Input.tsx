"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#7A7060]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-[8px] border bg-[#080807] px-4 text-sm text-white placeholder:text-[#7A7060]/60 transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent",
            error
              ? "border-[#E74C3C] focus:ring-[#E74C3C]"
              : "border-white/10 hover:border-white/20",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#E74C3C]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#7A7060]">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
export type { InputProps };
