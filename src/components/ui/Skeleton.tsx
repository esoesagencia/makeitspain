import { cn } from "@/lib/utils/cn";
import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  pill?: boolean;
}

export function Skeleton({ pill, className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[#D94040]/08 rounded-lg",
        pill && "rounded-full",
        className,
      )}
      {...props}
    />
  );
}

export function TripCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5"
      style={{ border: "1px solid rgba(180,100,90,0.1)", boxShadow: "0 1px 4px rgba(120,60,50,0.06)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
        <Skeleton pill className="h-6 w-20" />
      </div>
      <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(180,100,90,0.08)" }}>
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  );
}
