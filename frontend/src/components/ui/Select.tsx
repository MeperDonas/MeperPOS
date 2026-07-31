import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", ...props }, ref) => {
    const id = useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            "w-full cursor-pointer appearance-none rounded-lg border bg-card px-4 py-2.5 text-sm text-foreground",
            "transition-all duration-200",
            "focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/15"
              : "border-border",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="mt-1.5 block text-xs font-medium text-red-500">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
