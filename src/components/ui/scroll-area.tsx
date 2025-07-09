import { ReactNode } from "react";

export function ScrollArea({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-auto rounded-md border h-[60vh] w-full">
      {children}
    </div>
  );
}