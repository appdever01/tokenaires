import { DatabaseSync } from 'node:sqlite';

export function makeVsCodeDb(
  path: string,
  turns: Array<{
    turnId: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    parts?: Array<{ startedAt?: number; text?: string }>;
  }>,
  options?: {
    createEmpty?: boolean;
  },
): void {
  const db = new DatabaseSync(path);
  if (options?.createEmpty) {
    db.close();
    return;
  }

  db.exec(`
    CREATE TABLE turn_usage (
      turn_id TEXT PRIMARY KEY,
      usage TEXT NOT NULL
    );
    CREATE TABLE assistant_response_parts (
      turn_id TEXT,
      parts TEXT NOT NULL
    );
  `);

  const insertUsage = db.prepare(`
    INSERT INTO turn_usage (turn_id, usage)
    VALUES (?, ?)
  `);

  const insertParts = db.prepare(`
    INSERT INTO assistant_response_parts (turn_id, parts)
    VALUES (?, ?)
  `);

  for (const turn of turns) {
    const usageObj: Record<string, unknown> = {};
    if (turn.model !== undefined) usageObj.model = turn.model;
    if (turn.inputTokens !== undefined) usageObj.inputTokens = turn.inputTokens;
    if (turn.outputTokens !== undefined) usageObj.outputTokens = turn.outputTokens;
    if (turn.cacheReadTokens !== undefined) usageObj.cacheReadTokens = turn.cacheReadTokens;
    if (turn.cacheWriteTokens !== undefined) usageObj.cacheWriteTokens = turn.cacheWriteTokens;

    insertUsage.run(turn.turnId, JSON.stringify(usageObj));

    if (turn.parts !== undefined) {
      insertParts.run(turn.turnId, JSON.stringify(turn.parts));
    }
  }

  db.close();
}
