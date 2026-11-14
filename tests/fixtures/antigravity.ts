import { protoBytes, protoInt, protoMessage } from '../helpers/proto';

export const ANTIGRAVITY_CASCADE = '6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d';
export const ANTIGRAVITY_SECRET = 'ANTIGRAVITY_SECRET_PROMPT';

const seconds = (iso: string): number => Math.floor(Date.parse(iso) / 1000);
const timestamp = (number: number, iso: string): Uint8Array => protoBytes(number, protoMessage(protoInt(1, seconds(iso)), protoInt(2, 0)));

interface GenerationSpec {
  responseId?: string;
  requestId?: string;
  usage: Partial<Record<'input' | 'output' | 'cacheWrite' | 'cacheRead' | 'thinking' | 'response', number>>;
  createdAt?: string;
  model?: string;
  steps?: number[];
}

const USAGE_FIELDS = { input: 2, output: 3, cacheWrite: 4, cacheRead: 5, thinking: 9, response: 10 } as const;

export function generation(spec: GenerationSpec): Uint8Array {
  const usageFields = Object.entries(spec.usage).map(([key, value]) => protoInt(USAGE_FIELDS[key as keyof typeof USAGE_FIELDS], value));
  if (spec.responseId) usageFields.push(protoBytes(11, spec.responseId));
  const chat = protoMessage(
    protoBytes(2, ANTIGRAVITY_SECRET),
    protoBytes(4, protoMessage(...usageFields)),
    ...(spec.createdAt ? [protoBytes(9, protoMessage(timestamp(4, spec.createdAt)))] : []),
    protoBytes(20, protoMessage(protoBytes(1, 'model_enum'), protoBytes(2, 'MODEL_PLACEHOLDER_M71'))),
    ...(spec.model ? [protoBytes(21, spec.model)] : []),
  );
  return protoMessage(protoBytes(1, chat), protoBytes(2, Uint8Array.from(spec.steps ?? [])), ...(spec.requestId ? [protoBytes(4, spec.requestId)] : []));
}

export function stepMetadata(iso: string): Uint8Array {
  return protoMessage(timestamp(1, iso));
}
