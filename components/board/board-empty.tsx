import type { BoardPeriod, BoardSource } from "@tokenaires/contracts";
import { InstallCommand } from "@/components/home/install-command";
import { PERIOD_LABELS, SOURCE_FILTER_LABELS } from "@/lib/constants";

interface BoardEmptyProps {
  period: BoardPeriod;
  source: BoardSource;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export function BoardEmpty({
  period,
  source,
  searchQuery = "",
  onClearSearch,
}: BoardEmptyProps) {
  const isSearch = Boolean(searchQuery.trim());
  const filtered = isSearch || period !== "all" || source !== "all";

  return (
    <div className="mt-6 flex flex-col items-center px-4 py-8 text-center">
      <p className="text-base font-medium">
        {isSearch ? "No developers found" : filtered ? "Nobody here yet" : "The list is empty"}
      </p>
      <p className="mt-1.5 max-w-sm text-sm text-t3">
        {isSearch ? (
          <>
            No one matching <span className="font-semibold text-foreground">"{searchQuery}"</span> was found.
          </>
        ) : filtered ? (
          `No usage in ${SOURCE_FILTER_LABELS[source]} for ${PERIOD_LABELS[period].toLowerCase()}.`
        ) : (
          "Run the command below and take the first seat."
        )}
      </p>
      {isSearch && onClearSearch ? (
        <button
          type="button"
          onClick={onClearSearch}
          className="mt-4 rounded-full border border-line-strong px-4 py-1.5 text-xs font-medium text-t2 transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          Clear search
        </button>
      ) : (
        !filtered && <InstallCommand className="mt-5" />
      )}
    </div>
  );
}
