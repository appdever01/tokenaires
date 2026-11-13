import { readFile } from 'node:fs/promises';
import type { UsageRecord } from '@tokenaires/contracts';
import { child, count, epochTime, nativeId, parseObject, text } from '@/parsers/json';
import { hasTokens, keepLargest } from '@/parsers/merge';

function recordsFromEntry(entry: Record<string, unknown>): UsageRecord[] {
  const update = child(child(entry, 'params'), 'update');
  if (!update || update.sessionUpdate !== 'turn_completed' || update.usageIsIncomplete === true) return [];

  const promptId = text(update, 'prompt_id');
  const occurredAt = epochTime(update.timestamp) ?? epochTime(entry.timestamp);
  const modelUsage = child(child(update, 'usage'), 'modelUsage');
  if (!promptId || !occurredAt || !modelUsage) return [];

  const records: UsageRecord[] = [];
  for (const model of Object.keys(modelUsage)) {
    const usage = child(modelUsage, model);
    const recordId = nativeId(promptId, model);
    if (!usage || !recordId) continue;

    const totalInput = count(usage, 'inputTokens');
    const cacheReadTokens = count(usage, 'cachedReadTokens');
    const cacheWriteTokens = count(usage, 'cacheCreationTokens');
    if (totalInput < cacheReadTokens + cacheWriteTokens) continue;

    const record: UsageRecord = {
      source: 'grok-build',
      recordId,
      model,
      occurredAt,
      inputTokens: totalInput - cacheReadTokens - cacheWriteTokens,
      outputTokens: count(usage, 'outputTokens'),
      cacheReadTokens,
      cacheWriteTokens,
      reasoningTokens: count(usage, 'reasoningTokens'),
    };
    if (hasTokens(record)) records.push(record);
  }
  return records;
}

export function readGrokBuildLog(contents: string): UsageRecord[] {
  const records = new Map<string, UsageRecord>();
  for (const line of contents.split(/\r?\n/)) {
    if (!line.includes('"turn_completed"')) continue;
    const entry = parseObject(line);
    if (!entry) continue;
    for (const record of recordsFromEntry(entry)) keepLargest(records, record);
  }
  return [...records.values()];
}

export async function parseGrokBuildFile(path: string): Promise<UsageRecord[] | null> {
  try {
    return readGrokBuildLog(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}
