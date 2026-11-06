import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-full border border-line-strong bg-panel px-3.5 text-[13px] text-foreground placeholder:text-t4 outline-none transition-[border-color,box-shadow] duration-150 hover:border-foreground/30 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 sm:h-10",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
