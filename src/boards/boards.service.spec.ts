jest.mock('./boards.repository', () => ({
  BoardsRepository: class BoardsRepository {},
}));

import { BoardsRepository, BoardRow } from './boards.repository';
import { BoardsService } from './boards.service';

describe('BoardsService', () => {
  const mockRepository = {
    page: jest.fn(),
    stats: jest.fn(),
    rankOf: jest.fn(),
  } as unknown as BoardsRepository;

  const service = new BoardsService(mockRepository);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('preserves the sorted order of sources from the repository', async () => {
    const rows: BoardRow[] = [
      {
        rank: '1',
        previous_rank: '2',
        tokens: '5000000',
        output_tokens: '1000000',
        sources: ['antigravity', 'claude-code', 'codex'],
        handle: 'alice',
        name: 'Alice Developer',
        avatar_url: 'https://example.com/alice.png',
        country: 'US',
        status: 'ok',
      },
    ];

    (mockRepository.page as jest.Mock).mockResolvedValue({
      rows,
      total: 1,
      leader: 5000000,
    });

    const result = await service.board({
      period: 'week',
      source: 'all',
      page: 1,
    });

    expect(mockRepository.page).toHaveBeenCalledWith('week', 'all', 0, 50);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].sources).toEqual([
      'antigravity',
      'claude-code',
      'codex',
    ]);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].change).toBe(1);
  });
});
