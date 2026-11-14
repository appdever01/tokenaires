import type { UsageRecord } from '@tokenaires/contracts';
import { epochTime, isoTime, nativeId } from '@/parsers/json';
import { hasTokens } from '@/parsers/merge';
import {
  decodeProto,
  protoCount,
  protoField,
  protoMessage,
  protoPackedVarints,
  protoText,
  type ProtoField,
} from '@/parsers/proto';

export interface GenerationRow {
  data: Uint8Array;
}

const CHAT = 1;
const STEP_INDICES = 2;
const CHAT_USAGE = 4;
const CHAT_START = 9;
const START_CREATED_AT = 4;
const CHAT_MODEL = 19;
const CHAT_ATTRIBUTE = 20;
const CHAT_MODEL_NAME = 21;
const STEP_CREATED_AT = 1;
const USAGE = { input: 2, output: 3, cacheWrite: 4, cacheRead: 5, thinking: 9, response: 10, responseId: 11 } as const;
const MODEL_ENUM_KEY = 'model_enum';
const PLACEHOLDER_PREFIX = 'MODEL_PLACEHOLDER_';

export function protoTime(field: ProtoField | undefined): string | null {
  if (!field) return null;
  if (field.value !== undefined) return epochTime(Number(field.value));
  const asText = protoText(field);
  if (asText && /^\d{4}-\d{2}-\d{2}T/.test(asText)) return isoTime(asText);
  const stamp = decodeProto(field.bytes);
  const seconds = protoCount(stamp, 1);
  if (seconds === 0) return null;
  return epochTime(seconds * 1000 + Math.floor(protoCount(stamp, 2) / 1e6));
}

function modelEnum(chat: readonly ProtoField[]): string | null {
  for (const field of chat) {
    if (field.number !== CHAT_ATTRIBUTE) continue;
    const pair = decodeProto(field.bytes);
    if (protoText(protoField(pair, 1)) === MODEL_ENUM_KEY) return protoText(protoField(pair, 2));
  }
  return null;
}

function modelName(chat: readonly ProtoField[]): string | null {
  const raw = protoText(protoField(chat, CHAT_MODEL)) ?? protoText(protoField(chat, CHAT_MODEL_NAME));
  if (raw) return raw;
  const named = modelEnum(chat);
  return named && !named.startsWith(PLACEHOLDER_PREFIX) ? named : null;
}

function occurredAt(root: readonly ProtoField[], chat: readonly ProtoField[], stepTimes: ReadonlyMap<number, string>): string | null {
  const started = protoTime(protoField(protoMessage(chat, CHAT_START), START_CREATED_AT));
  if (started) return started;
  const firstStep = protoPackedVarints(protoField(root, STEP_INDICES))[0];
  return firstStep === undefined ? null : (stepTimes.get(firstStep) ?? null);
}

export function stepTime(metadata: Uint8Array | null): string | null {
  return metadata ? protoTime(protoField(decodeProto(metadata), STEP_CREATED_AT)) : null;
}

export function antigravityRecord(cascadeId: string, row: GenerationRow, stepTimes: ReadonlyMap<number, string>): UsageRecord | null {
  const root = decodeProto(row.data);
  const chat = protoMessage(root, CHAT);
  const usage = protoMessage(chat, CHAT_USAGE);
  const rawId = protoText(protoField(usage, USAGE.responseId)) ?? protoText(protoField(root, 4));
  const recordId = nativeId(cascadeId, rawId);
  const model = modelName(chat);
  const when = occurredAt(root, chat, stepTimes);
  if (!recordId || !model || !when) return null;
  const thinking = protoCount(usage, USAGE.thinking);
  const reported = protoCount(usage, USAGE.output);
  const record: UsageRecord = {
    source: 'antigravity',
    recordId,
    model,
    occurredAt: when,
    inputTokens: protoCount(usage, USAGE.input),
    outputTokens: reported > 0 ? reported : thinking + protoCount(usage, USAGE.response),
    cacheReadTokens: protoCount(usage, USAGE.cacheRead),
    cacheWriteTokens: protoCount(usage, USAGE.cacheWrite),
    reasoningTokens: thinking,
  };
  return hasTokens(record) ? record : null;
}
