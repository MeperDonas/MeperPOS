import { cn } from "@/lib/utils";
import { chipStyles } from "@/lib/chipStyles";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "primary" | "secondary";
  dot?: boolean;
  className?: string;
}

const variants = {
  default:
    "bg-muted text-muted-foreground border border-border",
  success:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  warning:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  danger:
    "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
  primary:
    "bg-primary-light text-primary border border-primary/30",
  secondary:
    "bg-muted/80 text-foreground border border-border",
};

const dotColors = {
  default: "bg-muted-foreground",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  primary: "bg-primary",
  secondary: "bg-foreground",
};

export function Badge({ children, variant = "default", dot = false, className = "" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-tight shadow-xs",
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full mr-1.5 shrink-0", dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}
