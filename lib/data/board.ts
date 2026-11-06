import type { BoardResponse, GlobalStats } from "@tokenaires/contracts";
import { cacheLife } from "next/cache";
import { getBoard, getStats } from "@/lib/api/boards";

export async function getCachedLeaders(): Promise<{ board: BoardResponse; stats: GlobalStats } | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const [board, stats] = await Promise.all([getBoard({ period: "all", source: "all", page: 1, q: "" }), getStats()]);
    return { board, stats };
  } catch {
    return null;
  }
}
