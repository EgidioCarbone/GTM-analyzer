// src/components/ui/ScrollArea.tsx
import { ReactNode } from "react";
import { cn } from "../../lib/utils"; 

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}

export function ScrollArea({ children, className }: ScrollAreaProps) {
  return (
    <div className={cn("overflow-auto rounded-md border border-gray-200 p-2", className)}>
      {children}
    </div>
  );
}