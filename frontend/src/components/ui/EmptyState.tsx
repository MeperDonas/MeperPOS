import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}

export function EmptyState({ icon, title, subtitle, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[200px] text-center", className)}>
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
