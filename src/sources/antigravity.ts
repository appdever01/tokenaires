import { basename } from 'node:path';
import type { UsageRecord } from '@tokenaires/contracts';
import type { DatabaseSync } from 'node:sqlite';
import { findAll, type FileFilter } from '@/files/walk';
import { antigravityRecord, stepTime } from '@/parsers/antigravity';
import { antigravityRoots, t3AntigravityRoots } from '@/parsers/paths';
import { dbSignature, withReadOnlyDb } from '@/sqlite/open';
import type { LogSource } from '@/sources/types';

const DB_SUFFIX = '.db';
const GENERATIONS = 'SELECT data FROM gen_metadata ORDER BY idx';
const STEPS = 'SELECT idx, metadata FROM steps';

const isConversation: FileFilter = (_path, name) => name.endsWith(DB_SUFFIX);

function bytes(value: unknown): Uint8Array | null {
  return value instanceof Uint8Array ? value : null;
}

function readSteps(db: DatabaseSync): Map<number, string> {
  const times = new Map<number, string>();
  try {
    for (const row of db.prepare(STEPS).all()) {
      const time = stepTime(bytes(row.metadata));
      if (typeof row.idx === 'number' && time) times.set(row.idx, time);
    }
  } catch {
    return times;
  }
  return times;
}

export function readConversation(db: DatabaseSync, cascadeId: string): UsageRecord[] {
  const steps = readSteps(db);
  const records = new Map<string, UsageRecord>();
  for (const row of db.prepare(GENERATIONS).all()) {
    const data = bytes(row.data);
    const record = data ? antigravityRecord(cascadeId, { data }, steps) : null;
    if (record && !records.has(record.recordId)) records.set(record.recordId, record);
  }
  return [...records.values()];
}

export const antigravitySource: LogSource = {
  source: 'antigravity',
  discover: async (ctx) => {
    const t3Roots = await t3AntigravityRoots(ctx.env, ctx.home);
    return findAll([...antigravityRoots(ctx.home), ...t3Roots], isConversation);
  },
  parse: (path) => withReadOnlyDb(path, (db) => readConversation(db, basename(path, DB_SUFFIX))),
  signature: dbSignature,
};
