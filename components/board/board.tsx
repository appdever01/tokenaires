"use client";

import type { BoardEntry } from "@tokenaires/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardParams } from "@/lib/api/boards";
import { boardQueryString, cleanSearch, readBoardParams, searchPushed, searchSyncFrom, searchUrlChanged } from "@/lib/board-params";
import { boardQueryOptions, useBoard } from "@/hooks/use-board";
import { BoardControls } from "./board-controls";
import { BoardEmpty } from "./board-empty";
import { BoardError } from "./board-error";
import { BoardPagination } from "./board-pagination";
import { RowsSkeleton, TopThreeSkeleton } from "./board-skeleton";
import { RankHeader, RankRow } from "./rank-row";
import { TopThree } from "./top-three";

const SEARCH_DELAY_MS = 300;

export function Board() {
  const queryClient = useQueryClient();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [params, setParams] = useState<BoardParams>(() => {
    if (typeof window !== "undefined") {
      return readBoardParams(new URLSearchParams(window.location.search));
    }
    return { period: "all", source: "all", page: 1, q: "" };
  });
  const { data, isPending, isError, refetch, isFetching } = useBoard(params);

  useEffect(() => {
    const onPopState = () => {
      setParams(readBoardParams(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const update = useCallback(
    (next: Partial<BoardParams>) => {
      if (next.page !== undefined && sectionRef.current) {
        let top = 0;
        let curr: HTMLElement | null = sectionRef.current;
        while (curr) {
          top += curr.offsetTop;
          const parent: Element | null = curr.offsetParent;
          curr = parent instanceof HTMLElement ? parent : null;
        }
        if (window.scrollY > top) {
          window.scrollTo(0, top);
        }
      }
      setParams((prev) => {
        const resetPage = "period" in next || "source" in next || "q" in next;
        return { ...prev, ...(resetPage ? { page: 1 } : {}), ...next };
      });
    },
    [],
  );

  const prefetchPage = useCallback(
    (page: number) => {
      void queryClient.prefetchQuery(boardQueryOptions({ ...params, page }));
    },
    [params, queryClient],
  );

  const prevQ = useRef(params.q);
  useEffect(() => {
    const suffix = boardQueryString(params);
    const pathname = window.location.pathname;
    const nextUrl = suffix ? `${pathname}?${suffix}` : pathname;
    const currentUrl = window.location.pathname + window.location.search;
    if (nextUrl !== currentUrl) {
      if (prevQ.current !== params.q) {
        window.history.replaceState({ __NA: true }, "", nextUrl);
      } else {
        window.history.pushState({ __NA: true }, "", nextUrl);
      }
      prevQ.current = params.q;
    }
  }, [params]);

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

  const topThreeRef = useRef<BoardEntry[]>([]);
  const leaderRef = useRef(0);

  useEffect(() => {
    if (params.page === 1 && entries.length > 0) {
      const top = entries.filter((entry) => entry.rank <= 3);
      if (top.length > 0) {
        const prev = topThreeRef.current;
        const isSame =
          prev.length === top.length &&
          prev.every(
            (entry, i) =>
              entry.user.handle === top[i].user.handle &&
              entry.tokens === top[i].tokens &&
              entry.rank === top[i].rank,
          );
        if (!isSame) {
          topThreeRef.current = top;
        }
      }
    }
  }, [entries, params.page]);

  useEffect(() => {
    if (data?.leaderTokens) {
      leaderRef.current = data.leaderTokens;
    }
  }, [data?.leaderTokens]);

  const topThree = params.page === 1 && entries.length > 0
    ? (topThreeRef.current.length > 0 ? topThreeRef.current : entries.filter((entry) => entry.rank <= 3))
    : topThreeRef.current;
  const leader = data?.leaderTokens ?? leaderRef.current;
  const rows = showTopThree ? entries.filter((entry) => entry.rank > 3) : entries;

  return (
    <section ref={sectionRef} aria-label="Rich list" className="panel p-3 sm:p-5">
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
            <div className={showTopThree ? undefined : "hidden"} aria-hidden={!showTopThree}>
              <TopThree entries={topThree} leader={leader} />
            </div>
            {rows.length > 0 && (
              <div className={showTopThree ? "mt-6" : undefined}>
                <RankHeader />
                <ol className="flex flex-col">
                  {rows.map((entry, index) => (
                    <RankRow
                      key={index}
                      entry={entry}
                      leader={leader}
                      showMovement={params.period === "all"}
                    />
                  ))}
                </ol>
              </div>
            )}
            <BoardPagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.totalEntries}
              onPageChange={(page) => update({ page })}
              onPrefetch={prefetchPage}
            />
          </>
        )}
      </div>
    </section>
  );
}
