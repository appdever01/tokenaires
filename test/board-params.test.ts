import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

const { getBoard } = await import("@/lib/api/boards");
const { BOARD_SEARCH_MAX_LENGTH, boardQueryString, readBoardParams, searchPushed, searchSyncFrom, searchUrlChanged } = await import(
  "@/lib/board-params"
);

const EMPTY_BOARD = {
  period: "all",
  source: "all",
  generatedAt: "2026-11-06T12:00:00.000Z",
  page: 1,
  pageSize: 50,
  totalEntries: 0,
  leaderTokens: 0,
  entries: [],
};

describe("board params", () => {
  it("reads defaults from an empty URL", () => {
    expect(readBoardParams(new URLSearchParams())).toEqual({ period: "all", source: "all", page: 1, q: "" });
  });

  it("reads the search term, trimmed and capped", () => {
    expect(readBoardParams(new URLSearchParams("q=%20%40ada%20")).q).toBe("@ada");
    expect(readBoardParams(new URLSearchParams(`q=${"a".repeat(200)}`)).q).toHaveLength(BOARD_SEARCH_MAX_LENGTH);
  });

  it("ignores unknown periods and tools", () => {
    const params = readBoardParams(new URLSearchParams("period=year&tool=nope&page=-3"));
    expect(params).toMatchObject({ period: "all", source: "all", page: 1 });
  });

  it("writes only non-default values back to the URL", () => {
    expect(boardQueryString({ period: "all", source: "all", page: 1, q: "  " })).toBe("");
    expect(boardQueryString({ period: "week", source: "codex", page: 2, q: " ada " })).toBe(
      "period=week&tool=codex&q=ada&page=2",
    );
  });

  it("round-trips through the URL", () => {
    const params = { period: "month", source: "claude-code", page: 3, q: "Ada Lovelace" } as const;
    expect(readBoardParams(new URLSearchParams(boardQueryString(params)))).toEqual(params);
  });
});

describe("getBoard", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: EMPTY_BOARD });
  });

  it("leaves q off the request when there is no search", async () => {
    await getBoard({ period: "all", source: "all", page: 1, q: "" });
    expect(get).toHaveBeenCalledWith("/boards", { params: { period: "all", source: "all", page: 1 } });
  });

  it("sends the search term to the API", async () => {
    await getBoard({ period: "week", source: "all", page: 2, q: "ada" });
    expect(get).toHaveBeenCalledWith("/boards", { params: { period: "week", source: "all", page: 2, q: "ada" } });
  });
});

describe("search box and URL sync", () => {
  it("keeps typing that lands after an older search reaches the URL", () => {
    let state = searchPushed({ ...searchSyncFrom(""), input: "ada" }, "ada");
    state = { ...state, input: "ada lov" };
    state = searchUrlChanged(state, "ada");
    expect(state).toEqual({ input: "ada lov", urlQ: "ada", inFlight: [] });
  });

  it("skips past older in-flight searches when a newer one lands first", () => {
    let state = searchPushed(searchPushed(searchSyncFrom(""), "ad"), "ada");
    state = searchUrlChanged({ ...state, input: "ada" }, "ada");
    expect(state).toEqual({ input: "ada", urlQ: "ada", inFlight: [] });
  });

  it("follows the URL when something else changes it", () => {
    const state = searchUrlChanged({ input: "ada", urlQ: "ada", inFlight: [] }, "");
    expect(state).toEqual({ input: "", urlQ: "", inFlight: [] });
  });

  it("returns the same state when the URL did not change", () => {
    const state = searchSyncFrom("ada");
    expect(searchUrlChanged(state, "ada")).toBe(state);
  });
});
