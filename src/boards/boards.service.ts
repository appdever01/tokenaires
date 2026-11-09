import { Injectable } from '@nestjs/common';
import {
  AgentSourceSchema,
  BOARD_PAGE_SIZE,
  BoardEntry,
  BoardResponse,
  GlobalStats,
  tierFor,
} from '@tokenaires/contracts';
import { BoardQueryDto } from './dto/board-query.dto';
import { BoardRow, BoardsRepository } from './boards.repository';

function toEntry(row: BoardRow): BoardEntry {
  const tokens = Number(row.tokens);
  const rank = Number(row.rank);
  const previous =
    row.previous_rank === null ? null : Number(row.previous_rank);
  return {
    rank,
    change: previous === null ? null : previous - rank,
    user: {
      handle: row.handle,
      name: row.name,
      avatarUrl: row.avatar_url,
      country: row.country,
    },
    tokens,
    outputTokens: Number(row.output_tokens),
    tier: tierFor(tokens),
    sources: (row.sources ?? []).flatMap((source) => {
      const parsed = AgentSourceSchema.safeParse(source);
      return parsed.success ? [parsed.data] : [];
    }),
    status: row.status,
  };
}

@Injectable()
export class BoardsService {
  constructor(private readonly repository: BoardsRepository) {}

  async board(query: BoardQueryDto): Promise<BoardResponse> {
    const offset = (query.page - 1) * BOARD_PAGE_SIZE;
    const { rows, total, leader } = await this.repository.page(
      query.period,
      query.source,
      offset,
      BOARD_PAGE_SIZE,
    );
    return {
      period: query.period,
      source: query.source,
      generatedAt: new Date().toISOString(),
      page: query.page,
      pageSize: BOARD_PAGE_SIZE,
      totalEntries: total,
      leaderTokens: leader,
      entries: rows.map(toEntry),
    };
  }

  async stats(): Promise<GlobalStats> {
    const row = await this.repository.stats();
    return {
      developers: Number(row.developers),
      totalTokens: Number(row.total_tokens ?? 0),
      tokensLast24h: Number(row.tokens_last_24h ?? 0),
      generatedAt: new Date().toISOString(),
    };
  }
}
