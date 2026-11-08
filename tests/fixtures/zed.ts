import { zstdCompressSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';

export function makeZedDb(
  path: string,
  threads: Array<{
    id: string;
    updatedAt: string;
    model?: string;
    requestUsage?: Record<
      string,
      {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      }
    >;
  }>,
): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data BLOB NOT NULL
    )
  `);

  const insert = db.prepare(`
    INSERT INTO threads (id, summary, updated_at, data_type, data)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const t of threads) {
    const payload = {
      title: 'Test thread',
      updated_at: t.updatedAt,
      model: t.model ? { model: t.model } : undefined,
      request_token_usage: t.requestUsage ?? {},
      cumulative_token_usage: {},
    };
    const jsonStr = JSON.stringify(payload);
    const compressed = zstdCompressSync(Buffer.from(jsonStr, 'utf8'));
    insert.run(t.id, 'Summary', t.updatedAt, 'zstd', compressed);
  }

  db.close();
}
