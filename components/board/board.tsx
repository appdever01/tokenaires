"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardParams } from "@/lib/api/boards";
import { boardQueryString, cleanSearch, readBoardParams, searchPushed, searchSyncFrom, searchUrlChanged } from "@/lib/board-params";
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
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const params = readBoardParams(search);
  const { data, isPending, isError, refetch, isFetching } = useBoard(params);

  const update = useCallback(
    (next: Partial<BoardParams>) => {
      const suffix = boardQueryString({ ...readBoardParams(search), page: 1, ...next });
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    },
    [pathname, router, search],
  );

  const [sync, setSync] = useState(() => searchSyncFrom(params.q));
  const synced = searchUrlChanged(sync, params.q);
  if (synced !== sync) setSync(synced);

  const updateRef = useRef(update);
  const urlQRef = useRef(params.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    updateRef.current = update;
    urlQRef.current = params.q;
  }, [update, params.q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onSearchChange = useCallback((value: string) => {
    setSync((state) => ({ ...state, input: value }));
    clearTimeout(timer.current);
    const push = () => {
      const q = cleanSearch(value);
      if (q === urlQRef.current) return;
      setSync((state) => searchPushed(state, q));
      updateRef.current({ q });
    };
    if (cleanSearch(value)) timer.current = setTimeout(push, SEARCH_DELAY_MS);
    else push();
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
        searchValue={synced.input}
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
