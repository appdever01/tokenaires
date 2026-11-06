export const BOARD_SEARCH_MAX_LENGTH = 64;

export function normalizeSearch(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const term = raw.trim().replace(/^@+/, '').trim();
  return term ? term.slice(0, BOARD_SEARCH_MAX_LENGTH) : null;
}

export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
