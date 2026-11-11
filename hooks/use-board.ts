"use client";

import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getBoard, getStats, type BoardParams } from "@/lib/api/boards";
import { queryKeys } from "@/lib/query-keys";

export const boardQueryOptions = (params: BoardParams) =>
  queryOptions({
    queryKey: queryKeys.board(params),
    queryFn: () => getBoard(params),
    placeholderData: keepPreviousData,
  });

export function useBoard(params: BoardParams) {
  const queryClient = useQueryClient();
  const query = useQuery(boardQueryOptions(params));

  const total = query.data?.totalEntries;
  const pageSize = query.data?.pageSize;
  const page = params.page;

  useEffect(() => {
    if (total === undefined || pageSize === undefined) return;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));

    if (page < maxPage) {
      void queryClient.prefetchQuery(boardQueryOptions({ ...params, page: page + 1 }));
    }
    if (page > 1) {
      void queryClient.prefetchQuery(boardQueryOptions({ ...params, page: page - 1 }));
    }
  }, [page, params, pageSize, total, queryClient]);

  return query;
}

export function useStats() {
  return useQuery({ queryKey: queryKeys.stats(), queryFn: getStats });
}
