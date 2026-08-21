import { type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterControls?: ReactNode;
  preContent?: ReactNode;
  postContent?: ReactNode;
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filterControls,
  preContent,
  postContent,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-1.5 shadow-xs overflow-hidden",
        className,
      )}
    >
      {preContent}
      <div className="flex items-center flex-wrap sm:flex-nowrap gap-2">
        {/* Search */}
        <div className="relative w-full sm:flex-1 sm:min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/40 rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/40 transition"
          />
        </div>
        {filterControls && (
          <div className="flex items-center gap-1.5 px-1 shrink-0 flex-wrap">
            {filterControls}
          </div>
        )}
      </div>
      {postContent}
    </div>
  );
}
