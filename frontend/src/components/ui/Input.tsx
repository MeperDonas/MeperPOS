import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  textarea?: boolean;
  rows?: number;
  icon?: React.ReactNode;
  prefixText?: string;
  suffixIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ label, error, textarea = false, rows = 3, className = "", icon, prefixText, suffixIcon, required, id, ...props }, ref) => {
    const reactId = useId();
    const inputId = id || reactId;

    const commonClasses = cn(
      "w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs text-foreground",
      "placeholder:text-muted-foreground/60",
      "transition-all duration-200 shadow-xs",
      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
      icon && "pl-10",
      prefixText && "pl-8 font-mono",
      suffixIcon && "pr-10",
      error
        ? "border-danger focus:border-danger focus:ring-danger/20"
        : "border-border hover:border-primary/40",
      className,
    );

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {icon}
            </span>
          )}
          {prefixText && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-primary pointer-events-none">
              {prefixText}
            </span>
          )}
          {textarea ? (
            <textarea
              ref={ref as React.RefObject<HTMLTextAreaElement>}
              id={inputId}
              rows={rows}
              required={required}
              aria-required={required}
              className={cn(commonClasses, "resize-none")}
              {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.RefObject<HTMLInputElement>}
              id={inputId}
              required={required}
              aria-required={required}
              className={commonClasses}
              {...props}
            />
          )}
          {suffixIcon && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {suffixIcon}
            </span>
          )}
        </div>
        {error && (
          <span className="mt-1.5 block text-xs font-medium text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
