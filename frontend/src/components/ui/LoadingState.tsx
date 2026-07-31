import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface LoadingStateProps {
  icon: ReactNode;
  message: string;
  className?: string;
}

export function LoadingState({ icon, message, className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[200px]", className)}>
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground mt-3">{message}</p>
    </div>
  );
}
