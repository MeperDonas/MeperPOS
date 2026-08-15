import { cn } from "@/lib/utils";

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: "primary" | "accent";
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({
  title,
  description,
  icon,
  tone = "primary",
  children,
  className,
}: SettingsCardProps) {
  const isAccent = tone === "accent";

  return (
    <section
      className={cn(
        "rounded-3xl border overflow-hidden",
        isAccent ? "border-accent/30 bg-accent/10" : "border-primary/30 bg-primary/10",
        className
      )}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-black/5 dark:border-white/5">
        {icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              isAccent ? "bg-accent/20" : "bg-primary/20"
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
