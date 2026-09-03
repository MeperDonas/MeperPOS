import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ErrorStateProps {
  icon?: ReactNode;
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  icon = <AlertTriangle className="w-5 h-5" />,
  title,
  message,
  retryLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center min-h-[200px] rounded-xl bg-red-500/10 border border-red-500/20 px-6",
        className,
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
        {icon}
      </div>
      {title && <p className="text-sm font-semibold text-foreground mt-3">{title}</p>}
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
      {onRetry && retryLabel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
