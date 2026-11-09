"use client";

import { CloseCircleIcon, MagnifierIcon } from "@solar-icons/react/linear";
import { useCallback, useRef } from "react";
import { BOARD_SEARCH_MAX_LENGTH } from "@/lib/board-params";
import { cn } from "@/lib/utils";

interface BoardSearchProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function BoardSearch({
  value,
  onChange,
  className,
  placeholder = "Search developers by name or handle...",
}: BoardSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div role="search" className={cn("relative flex items-center", className)}>
      <MagnifierIcon
        className="pointer-events-none absolute left-3.5 size-4 text-t3 select-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        aria-label="Search the rich list"
        maxLength={BOARD_SEARCH_MAX_LENGTH}
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-full border border-line-strong bg-panel pl-9 pr-9 text-[13px] text-foreground placeholder:text-t4 transition-[border-color,box-shadow] duration-150 hover:border-foreground/30 focus-visible:border-accent sm:h-10 sm:text-sm",
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 inline-flex size-6 items-center justify-center rounded-full text-t3 transition-colors hover:text-foreground"
        >
          <CloseCircleIcon className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
