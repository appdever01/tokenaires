import {
  BOARD_SEARCH_MAX_LENGTH,
  likePattern,
  normalizeSearch,
} from './search';

describe('normalizeSearch', () => {
  it('returns null for missing or blank input', () => {
    expect(normalizeSearch(undefined)).toBeNull();
    expect(normalizeSearch('   ')).toBeNull();
    expect(normalizeSearch('@')).toBeNull();
  });

  it('drops a leading @ so handles can be typed as shown', () => {
    expect(normalizeSearch(' @ada ')).toBe('ada');
    expect(normalizeSearch('@@ada')).toBe('ada');
    expect(normalizeSearch('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('caps the term length', () => {
    expect(normalizeSearch('a'.repeat(200))).toHaveLength(
      BOARD_SEARCH_MAX_LENGTH,
    );
  });
});

describe('likePattern', () => {
  it('wraps the term for a substring match', () => {
    expect(likePattern('ada')).toBe('%ada%');
  });

  it('escapes LIKE wildcards and the escape character', () => {
    expect(likePattern('100%_\\x')).toBe('%100\\%\\_\\\\x%');
  });
});
