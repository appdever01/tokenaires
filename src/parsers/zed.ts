import { zstdDecompressSync } from 'node:zlib';
import type { DatabaseSync } from 'node:sqlite';
import type { UsageRecord } from '@tokenaires/contracts';
import { child, count, isObject, isoTime, parseObject, RECORD_ID_PATTERN, text, type JsonObject } from '@/parsers/json';
import { hasTokens } from '@/parsers/merge';
import { dbSignature, withReadOnlyDb } from '@/sqlite/open';

interface ZedDbRow {
  id: unknown;
  updated_at: unknown;
  data_type: unknown;
  data: unknown;
}

export function parseZedPayload(data: Uint8Array, dataType: string): JsonObject | null {
  try {
    const raw = dataType === 'zstd' ? zstdDecompressSync(data) : data;
    return parseObject(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8'));
  } catch {
    return null;
  }
}

export function zedRecordId(threadId: string, userMessageId: string): string | null {
  const recordId = `${threadId}:${userMessageId}`;
  return RECORD_ID_PATTERN.test(recordId) ? recordId : null;
}

function recordFromUsage(recordId: string, usage: JsonObject, model: string, occurredAt: string): UsageRecord | null {
  const outputTokens = count(usage, 'output_tokens');
  if (outputTokens === 0) return null;
  const record: UsageRecord = {
    source: 'zed',
    recordId,
    model,
    occurredAt,
    inputTokens: count(usage, 'input_tokens'),
    outputTokens,
    cacheReadTokens: count(usage, 'cache_read_input_tokens'),
    cacheWriteTokens: count(usage, 'cache_creation_input_tokens'),
    reasoningTokens: 0,
  };
  return hasTokens(record) ? record : null;
}

function threadRecords(row: ZedDbRow): UsageRecord[] {
  if (typeof row.id !== 'string' || !(row.data instanceof Uint8Array)) return [];
  const thread = parseZedPayload(row.data, typeof row.data_type === 'string' ? row.data_type : '');
  const model = text(child(thread, 'model'), 'model')?.trim();
  const usage = child(thread, 'request_token_usage');
  const occurredAt = isoTime(thread?.updated_at) ?? isoTime(row.updated_at);
  if (!model || !usage || !occurredAt) return [];
  const records: UsageRecord[] = [];
  for (const [messageId, entry] of Object.entries(usage)) {
    const recordId = zedRecordId(row.id, messageId);
    const record = recordId && isObject(entry) ? recordFromUsage(recordId, entry, model, occurredAt) : null;
    if (record) records.push(record);
  }
  return records;
}

export function readZedDb(db: DatabaseSync): UsageRecord[] {
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'threads'").get();
  if (!table) return [];
  const rows = db.prepare('SELECT id, updated_at, data_type, data FROM threads').all() as unknown as ZedDbRow[];
  const records = new Map<string, UsageRecord>();
  for (const row of rows) {
    for (const record of threadRecords(row)) {
      if (!records.has(record.recordId)) records.set(record.recordId, record);
    }
  }
  return [...records.values()];
}

export async function parseZedFile(path: string): Promise<UsageRecord[] | null> {
  return withReadOnlyDb(path, readZedDb);
}

export const zedSignature = dbSignature;
