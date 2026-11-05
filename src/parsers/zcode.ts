import type { UsageRecord } from '@tokenaires/contracts';
import { eachLine } from '@/files/lines';
import { bytesHave, child, count, isoTime, markerBuffers, nativeId, parseObject, text, type JsonObject } from '@/parsers/json';
import { hasTokens } from '@/parsers/merge';

const MARKERS = markerBuffers('"usage"');

interface Tokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
}

function modelOf(entry: JsonObject): string | null {
  return (
    text(child(entry, 'response'), 'modelId') ??
    text(child(entry, 'model'), 'modelId') ??
    text(child(child(entry, 'request'), 'body'), 'model')
  );
}

function recordIdOf(entry: JsonObject, occurredAt: string): string | null {
  const requestId = text(entry, 'requestId');
  if (requestId) return nativeId(requestId);
  const sessionId = text(entry, 'sessionId');
  return nativeId(sessionId, text(entry, 'turnId'), occurredAt) ?? nativeId(sessionId, occurredAt);
}

function inputSide(usage: JsonObject): Pick<Tokens, 'inputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'> {
  const details = child(usage, 'inputTokenDetails');
  const cacheReadTokens = count(details, 'cacheReadTokens') || count(usage, 'cacheReadTokens') || count(usage, 'cachedInputTokens');
  const cacheWriteTokens = count(details, 'cacheWriteTokens') || count(usage, 'cacheWriteTokens');
  if (details && typeof details.noCacheTokens === 'number') {
    return { inputTokens: count(details, 'noCacheTokens'), cacheReadTokens, cacheWriteTokens };
  }
  const input = count(usage, 'inputTokens');
  const cached = cacheReadTokens + cacheWriteTokens;
  return { inputTokens: cached <= input ? input - cached : input, cacheReadTokens, cacheWriteTokens };
}

function outputSide(usage: JsonObject): Pick<Tokens, 'outputTokens' | 'reasoningTokens'> {
  const output = count(usage, 'outputTokens');
  const reasoningTokens = count(child(usage, 'outputTokenDetails'), 'reasoningTokens') || count(usage, 'reasoningTokens');
  const total = count(usage, 'totalTokens');
  const separate = reasoningTokens > output || (total > 0 && total === count(usage, 'inputTokens') + output + reasoningTokens);
  return { outputTokens: separate ? output + reasoningTokens : output, reasoningTokens };
}

export function zcodeTokens(usage: JsonObject): Tokens {
  return { ...inputSide(usage), ...outputSide(usage) };
}

function recordFrom(line: string): UsageRecord | null {
  const entry = parseObject(line);
  if (!entry) return null;
  const usage = child(child(entry, 'response'), 'usage');
  if (!usage) return null;
  const model = modelOf(entry);
  if (!model) return null;
  const occurredAt = isoTime(entry.completedAt);
  if (!occurredAt) return null;
  const recordId = recordIdOf(entry, occurredAt);
  if (!recordId) return null;
  const record: UsageRecord = { source: 'zcode', recordId, model, occurredAt, ...zcodeTokens(usage) };
  return hasTokens(record) ? record : null;
}

export async function parseZcodeFile(path: string): Promise<UsageRecord[] | null> {
  const into = new Map<string, UsageRecord>();
  const ok = await eachLine(path, (line) => {
    if (!bytesHave(line, MARKERS)) return;
    const record = recordFrom(line.toString('utf8'));
    if (record) into.set(record.recordId, record);
  });
  return ok ? [...into.values()] : null;
}
