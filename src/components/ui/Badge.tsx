// src/components/ui/Badge.tsx
import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const colorClasses = {
    default: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    success: "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-200",
    warning: "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200",
    error: "bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm",
        colorClasses[variant],
        className
      )}
      {...props}
    />
  );
}