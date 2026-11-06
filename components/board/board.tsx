"use client";

import { AGENT_SOURCES, BOARD_PERIODS, type BoardPeriod, type BoardSource } from "@tokenaires/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { useBoard } from "@/hooks/use-board";
import { useDebounce } from "@/hooks/use-debounce";
import { BoardControls } from "./board-controls";
import { BoardEmpty } from "./board-empty";
import { BoardError } from "./board-error";
import { BoardPagination } from "./board-pagination";
import { RowsSkeleton, TopThreeSkeleton } from "./board-skeleton";
import { RankHeader, RankRow } from "./rank-row";
import { TopThree } from "./top-three";

const SOURCES: ReadonlyArray<BoardSource> = ["all", ...AGENT_SOURCES];

function readParams(search: URLSearchParams): { period: BoardPeriod; source: BoardSource; page: number } {
  const period = BOARD_PERIODS.find((value) => value === search.get("period")) ?? "all";
  const source = SOURCES.find((value) => value === search.get("tool")) ?? "all";
  const page = Math.max(1, Math.floor(Number(search.get("page") ?? "1")) || 1);
  return { period, source, page };
}

export function Board() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const params = readParams(search);
  const { data, isPending, isError, refetch, isFetching } = useBoard(params);

  const [rawSearch, setRawSearch] = useState("");
  const debouncedSearch = useDebounce(rawSearch, 300);

  const update = useCallback(
    (next: Partial<{ period: BoardPeriod; source: BoardSource; page: number }>) => {
      const merged = { ...readParams(search), page: 1, ...next };
      const query = new URLSearchParams();
      if (merged.period !== "all") query.set("period", merged.period);
      if (merged.source !== "all") query.set("tool", merged.source);
      if (merged.page > 1) query.set("page", String(merged.page));
      const suffix = query.toString();
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    },
    [pathname, router, search],
  );

  const allEntries = data?.entries ?? [];

  const filteredEntries = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return allEntries;
    return allEntries
      .filter((entry) => {
        const handle = entry.user.handle.toLowerCase();
        const name = (entry.user.name ?? "").toLowerCase();
        return handle.includes(query) || name.includes(query);
      })
      .sort((a, b) => a.rank - b.rank);
  }, [allEntries, debouncedSearch]);

  const onFirstPage = params.page === 1;
  const isSearching = Boolean(debouncedSearch.trim());
  const topThree = onFirstPage && !isSearching ? filteredEntries.filter((entry) => entry.rank <= 3) : [];
  const rows = onFirstPage && !isSearching ? filteredEntries.filter((entry) => entry.rank > 3) : filteredEntries;

  const leader = data?.leaderTokens ?? 0;

  return (
    <section aria-label="Rich list" className="panel p-3 sm:p-5">
      <BoardControls
        period={params.period}
        source={params.source}
        searchValue={rawSearch}
        onPeriodChange={(period) => update({ period })}
        onSourceChange={(source) => update({ source })}
        onSearchChange={setRawSearch}
      />
      <div className="mt-5" aria-busy={isFetching}>
        {isPending ? (
          <>
            <TopThreeSkeleton />
            <div className="mt-6"><RowsSkeleton /></div>
          </>
        ) : isError ? (
          <BoardError onRetry={() => void refetch()} />
        ) : filteredEntries.length === 0 ? (
          <>
            {!isSearching && <TopThree entries={[]} leader={0} />}
            <BoardEmpty
              period={params.period}
              source={params.source}
              searchQuery={debouncedSearch}
              onClearSearch={() => setRawSearch("")}
            />
          </>
        ) : (
          <>
            {onFirstPage && !isSearching && <TopThree entries={topThree} leader={leader} />}
            {rows.length > 0 && (
              <div className={onFirstPage && !isSearching ? "mt-6" : ""}>
                <RankHeader />
                <ol className="flex flex-col">
                  <AnimatePresence mode="popLayout">
                    {rows.map((entry, index) => (
                      <RankRow
                        key={entry.user.handle}
                        entry={entry}
                        leader={leader}
                        index={index}
                        showMovement={params.period === "all" && !isSearching}
                      />
                    ))}
                  </AnimatePresence>
                </ol>
              </div>
            )}
            {!isSearching && (
              <BoardPagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.totalEntries}
                onPageChange={(page) => update({ page })}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
