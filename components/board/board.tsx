"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardParams } from "@/lib/api/boards";
import { boardQueryString, cleanSearch, readBoardParams } from "@/lib/board-params";
import { useBoard } from "@/hooks/use-board";
import { BoardControls } from "./board-controls";
import { BoardEmpty } from "./board-empty";
import { BoardError } from "./board-error";
import { BoardPagination } from "./board-pagination";
import { RowsSkeleton, TopThreeSkeleton } from "./board-skeleton";
import { RankHeader, RankRow } from "./rank-row";
import { TopThree } from "./top-three";

const SEARCH_DELAY_MS = 300;

export function Board() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [params, setParams] = useState(() => readBoardParams(search));
  const { data, isPending, isError, refetch, isFetching } = useBoard(params);

  useEffect(() => {
    const urlParams = readBoardParams(search);
    setParams((prev) => {
      if (
        prev.period === urlParams.period &&
        prev.source === urlParams.source &&
        prev.page === urlParams.page &&
        prev.q === urlParams.q
      ) {
        return prev;
      }
      return urlParams;
    });
  }, [search]);

  const update = useCallback(
    (next: Partial<BoardParams>) => {
      setParams((prev) => {
        const resetPage = "period" in next || "source" in next || "q" in next;
        return { ...prev, ...(resetPage ? { page: 1 } : {}), ...next };
      });
    },
    [],
  );

  useEffect(() => {
    const suffix = boardQueryString(params);
    const nextUrl = suffix ? `${pathname}?${suffix}` : pathname;
    const currentUrl = window.location.pathname + window.location.search;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [params, pathname]);

  const [searchInput, setSearchInput] = useState(params.q);
  const [pendingQ, setPendingQ] = useState(params.q);
  const [urlQ, setUrlQ] = useState(params.q);
  if (params.q !== urlQ) {
    setUrlQ(params.q);
    if (params.q !== pendingQ) {
      setSearchInput(params.q);
      setPendingQ(params.q);
    }
  }

  const updateRef = useRef(update);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    const q = cleanSearch(value);
    setPendingQ(q);
    clearTimeout(timer.current);
    if (!q) {
      updateRef.current({ q });
      return;
    }
    timer.current = setTimeout(() => updateRef.current({ q }), SEARCH_DELAY_MS);
  }, []);

  const entries = data?.entries ?? [];
  const isSearching = params.q !== "";
  const showTopThree = params.page === 1 && !isSearching;
  const topThree = showTopThree ? entries.filter((entry) => entry.rank <= 3) : [];
  const rows = showTopThree ? entries.filter((entry) => entry.rank > 3) : entries;

  const leader = data?.leaderTokens ?? 0;

  return (
    <section aria-label="Rich list" className="panel p-3 sm:p-5">
      <BoardControls
        period={params.period}
        source={params.source}
        searchValue={searchInput}
        onPeriodChange={(period) => update({ period })}
        onSourceChange={(source) => update({ source })}
        onSearchChange={onSearchChange}
      />
      <div className="mt-5" aria-busy={isFetching}>
        {isPending ? (
          <>
            <TopThreeSkeleton />
            <div className="mt-6"><RowsSkeleton /></div>
          </>
        ) : isError ? (
          <BoardError onRetry={() => void refetch()} />
        ) : entries.length === 0 ? (
          <>
            {!isSearching && <TopThree entries={[]} leader={0} />}
            <BoardEmpty
              period={params.period}
              source={params.source}
              searchQuery={params.q}
              onClearSearch={() => onSearchChange("")}
            />
          </>
        ) : (
          <>
            {showTopThree && <TopThree entries={topThree} leader={leader} />}
            {rows.length > 0 && (
              <div className={showTopThree ? "mt-6" : undefined}>
                <RankHeader />
                <ol className="flex flex-col">
                  <AnimatePresence mode="popLayout">
                    {rows.map((entry, index) => (
                      <RankRow
                        key={entry.user.handle}
                        entry={entry}
                        leader={leader}
                        index={index}
                        showMovement={params.period === "all"}
                      />
                    ))}
                  </AnimatePresence>
                </ol>
              </div>
            )}
            <BoardPagination page={data.page} pageSize={data.pageSize} total={data.totalEntries} onPageChange={(page) => update({ page })} />
          </>
        )}
      </div>
    </section>
  );
}
