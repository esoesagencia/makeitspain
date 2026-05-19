import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  gold?: boolean;
}

function Card({ gold, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] bg-[#111110] p-6",
        gold && "border border-[#C9A84C]/30",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card };
export type { CardProps };
