import { rankedTotals } from './boards.query';

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

describe('rankedTotals query builder', () => {
  it('aggregates sources ordered by token usage descending with tie breaker', () => {
    const query = rankedTotals('all', 'all');
    const text = sqlString(query as unknown as { queryChunks: unknown[] });

    expect(text).toContain(
      'array_agg(s.source order by s.source_tokens desc, s.source asc) as sources',
    );
    expect(text).toContain('group by d.user_id, u.created_at, d.source');
    expect(text).toContain('group by s.user_id, s.created_at');
    expect(text).toContain('having sum(s.source_tokens) > 0');
  });

  it('embeds the 7-day period window when week is selected', () => {
    const query = rankedTotals('week', 'all');
    const text = sqlString(query as unknown as { queryChunks: unknown[] }).replace(
      /\s+/g,
      ' ',
    );

    expect(text).toContain('d.day > current_date - 7 ::int');
  });

  it('embeds the 30-day period window when month is selected', () => {
    const query = rankedTotals('month', 'all');
    const text = sqlString(query as unknown as { queryChunks: unknown[] }).replace(
      /\s+/g,
      ' ',
    );

    expect(text).toContain('d.day > current_date - 30 ::int');
  });

  it('filters by single agent source when specified', () => {
    const query = rankedTotals('all', 'claude-code');
    const text = sqlString(query as unknown as { queryChunks: unknown[] }).replace(
      /\s+/g,
      ' ',
    );

    expect(text).toContain('d.source = claude-code');
  });
});

