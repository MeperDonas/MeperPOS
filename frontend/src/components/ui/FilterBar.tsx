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
        "rounded-xl border border-border/60 bg-card overflow-hidden",
        className,
      )}
    >
      {preContent}
      <div className="flex items-stretch flex-wrap sm:flex-nowrap">
        {/* Search */}
        <div className="relative w-full sm:flex-1 sm:min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none border-b sm:border-b-0 border-border/60"
          />
        </div>
        {filterControls && (
          <>
            <div className="hidden sm:block w-px bg-border/60 self-stretch my-2 shrink-0" />
            <div className="flex items-center gap-1.5 px-3 shrink-0 flex-wrap py-1.5">
              {filterControls}
            </div>
          </>
        )}
      </div>
      {postContent}
    </div>
  );
}
