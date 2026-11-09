import { AGENT_SOURCES, BOARD_PERIODS, type BoardSource } from "@tokenaires/contracts";
import type { BoardParams } from "@/lib/api/boards";

export const BOARD_SEARCH_MAX_LENGTH = 64;

const SOURCES: ReadonlyArray<BoardSource> = ["all", ...AGENT_SOURCES];

export function cleanSearch(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, BOARD_SEARCH_MAX_LENGTH);
}

export function readBoardParams(search: Pick<URLSearchParams, "get">): BoardParams {
  const period = BOARD_PERIODS.find((value) => value === search.get("period")) ?? "all";
  const source = SOURCES.find((value) => value === search.get("tool")) ?? "all";
  const page = Math.max(1, Math.floor(Number(search.get("page") ?? "1")) || 1);
  const q = cleanSearch(search.get("q"));
  return { period, source, page, q };
}

export function boardQueryString(params: BoardParams): string {
  const query = new URLSearchParams();
  if (params.period !== "all") query.set("period", params.period);
  if (params.source !== "all") query.set("tool", params.source);
  const q = cleanSearch(params.q);
  if (q) query.set("q", q);
  if (params.page > 1) query.set("page", String(params.page));
  return query.toString();
}

export interface SearchSync {
  input: string;
  urlQ: string;
  inFlight: readonly string[];
}

export function searchSyncFrom(q: string): SearchSync {
  return { input: q, urlQ: q, inFlight: [] };
}

export function searchPushed(state: SearchSync, q: string): SearchSync {
  return { ...state, inFlight: [...state.inFlight, q] };
}

export function searchUrlChanged(state: SearchSync, q: string): SearchSync {
  if (q === state.urlQ) return state;
  const index = state.inFlight.indexOf(q);
  if (index === -1) return searchSyncFrom(q);
  return { ...state, urlQ: q, inFlight: state.inFlight.slice(index + 1) };
}
