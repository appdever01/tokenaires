import {
  periodFilter,
  previousRanks,
  rankedTotals,
  sourceFilter,
} from './boards.query';

function sqlString(query: { queryChunks: unknown[] }): string {
  return query.queryChunks
    .map((chunk) => {
      if (typeof chunk === 'string' || typeof chunk === 'number') {
        return String(chunk);
      }
      if (chunk && typeof chunk === 'object') {
        if ('value' in chunk) {
          const val = (chunk as { value: unknown }).value;
          return Array.isArray(val) ? val.join('') : String(val);
        }
        if ('queryChunks' in chunk) {
          return sqlString(chunk as { queryChunks: unknown[] });
        }
      }
      return '';
    })
    .join(' ');
}

describe('boards.query', () => {
  describe('periodFilter', () => {
    it('returns true for all-time period', () => {
      const query = periodFilter('all');
      expect(sqlString(query as unknown as { queryChunks: unknown[] })).toContain(
        'true',
      );
    });

    it('returns 7-day window filter for week period', () => {
      const query = periodFilter('week');
      const text = sqlString(query as unknown as { queryChunks: unknown[] });
      expect(text).toContain('d.day > current_date -');
      expect(text).toContain('7');
    });

    it('returns 30-day window filter for month period', () => {
      const query = periodFilter('month');
      const text = sqlString(query as unknown as { queryChunks: unknown[] });
      expect(text).toContain('d.day > current_date -');
      expect(text).toContain('30');
    });
  });

  describe('sourceFilter', () => {
    it('returns true for all source', () => {
      const query = sourceFilter('all');
      expect(sqlString(query as unknown as { queryChunks: unknown[] })).toContain(
        'true',
      );
    });

    it('filters by specific source', () => {
      const query = sourceFilter('claude-code');
      const text = sqlString(query as unknown as { queryChunks: unknown[] });
      expect(text).toContain('d.source =');
      expect(text).toContain('claude-code');
    });
  });

  describe('rankedTotals', () => {
    it('generates query that aggregates sources in descending token usage order', () => {
      const query = rankedTotals('week', 'all');
      const text = sqlString(query as unknown as { queryChunks: unknown[] });
      expect(text).toContain(
        'array_agg(s.source order by s.source_tokens desc, s.source asc) as sources',
      );
      expect(text).toContain('group by d.user_id, u.created_at, d.source');
      expect(text).toContain('group by s.user_id, s.created_at');
    });
  });

  describe('previousRanks', () => {
    it('generates query for historical ranks', () => {
      const query = previousRanks('all');
      const text = sqlString(query as unknown as { queryChunks: unknown[] });
      expect(text).toContain('d.day <= current_date -');
      expect(text).toContain('7');
    });
  });
});
