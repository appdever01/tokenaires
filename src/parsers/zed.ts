import { zstdDecompressSync } from 'node:zlib';
import type { DatabaseSync } from 'node:sqlite';
import type { UsageRecord } from '@tokenaires/contracts';
import { isoTime, RECORD_ID_PATTERN, type JsonObject } from '@/parsers/json';
import { hasTokens } from '@/parsers/merge';
import { dbSignature, withReadOnlyDb } from '@/sqlite/open';

interface ZedRawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface ZedDbRow {
  id: string;
  updated_at: string;
  data_type: string;
  data: Buffer | Uint8Array;
}

function modelOf(thread: JsonObject): string | null {
  const modelObj = thread.model;
  if (!modelObj || typeof modelObj !== 'object') return null;
  const model = (modelObj as Record<string, unknown>).model;
  return typeof model === 'string' && model.trim() ? model.trim() : null;
}

export function parseZedPayload(data: Buffer | Uint8Array, dataType: string): JsonObject | null {
  try {
    const raw = dataType === 'zstd' ? zstdDecompressSync(data) : data;
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : new TextDecoder().decode(raw);
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonObject) : null;
  } catch {
    return null;
  }
}

function zedRecordId(threadId: string, userMessageId: string): string | null {
  const combined = `${threadId}:${userMessageId}`;
  return RECORD_ID_PATTERN.test(combined) ? combined : null;
}

function recordFromEntry(
  threadId: string,
  userMessageId: string,
  usage: ZedRawUsage,
  model: string,
  occurredAt: string,
): UsageRecord | null {
  const recordId = zedRecordId(threadId, userMessageId);
  if (!recordId) return null;
  const inputTokens = typeof usage.input_tokens === 'number' && Number.isFinite(usage.input_tokens) ? Math.max(0, Math.floor(usage.input_tokens)) : 0;
  const outputTokens = typeof usage.output_tokens === 'number' && Number.isFinite(usage.output_tokens) ? Math.max(0, Math.floor(usage.output_tokens)) : 0;
  const cacheReadTokens = typeof usage.cache_read_input_tokens === 'number' && Number.isFinite(usage.cache_read_input_tokens) ? Math.max(0, Math.floor(usage.cache_read_input_tokens)) : 0;
  const cacheWriteTokens = typeof usage.cache_creation_input_tokens === 'number' && Number.isFinite(usage.cache_creation_input_tokens) ? Math.max(0, Math.floor(usage.cache_creation_input_tokens)) : 0;

  const record: UsageRecord = {
    source: 'zed',
    recordId,
    model,
    occurredAt,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens: 0,
  };
  return hasTokens(record) ? record : null;
}

export function readZedDb(db: DatabaseSync): UsageRecord[] {
  const tableCheck = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='threads'").get();
  if (!tableCheck) return [];

  const records = new Map<string, UsageRecord>();
  const rows = db.prepare('SELECT id, updated_at, data_type, data FROM threads').all() as unknown as ZedDbRow[];

  for (const row of rows) {
    if (!row.id || !row.data) continue;
    const thread = parseZedPayload(row.data, row.data_type);
    if (!thread) continue;
    const model = modelOf(thread);
    if (!model) continue;
    const occurredAt = isoTime(thread.updated_at) ?? isoTime(row.updated_at);
    if (!occurredAt) continue;

    const requestUsage = thread.request_token_usage;
    if (requestUsage && typeof requestUsage === 'object' && !Array.isArray(requestUsage)) {
      for (const [messageId, usageObj] of Object.entries(requestUsage)) {
        if (!usageObj || typeof usageObj !== 'object') continue;
        const record = recordFromEntry(row.id, messageId, usageObj as ZedRawUsage, model, occurredAt);
        if (record && !records.has(record.recordId)) {
          records.set(record.recordId, record);
        }
      }
    }
  }

  return [...records.values()];
}

export async function parseZedFile(path: string): Promise<UsageRecord[] | null> {
  return withReadOnlyDb(path, readZedDb);
}

export const zedSignature = dbSignature;
