import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanLocal } from '@/scan';
import { antigravitySource } from '@/sources/antigravity';
import { ANTIGRAVITY_CASCADE, generation, stepMetadata } from './fixtures/antigravity';
import { createConversation } from './helpers/antigravity-db';
import { makeTempDir, removeDir } from './helpers/temp';

describe('Antigravity parser', () => {
  let root = '';
  let dbPath = '';
  beforeEach(async () => {
    root = await makeTempDir('antigravity');
    dbPath = join(root, '.gemini', 'antigravity-cli', 'conversations', `${ANTIGRAVITY_CASCADE}.db`);
  });
  afterEach(async () => {
    await removeDir(root);
  });

  const rows = {
    generations: [
      generation({ responseId: 'resp-ag-0001', model: 'Gemini Test Pro (High)', createdAt: '2026-10-06T09:00:00.000Z', usage: { input: 900, output: 160, cacheWrite: 50, cacheRead: 3000, thinking: 60, response: 100 } }),
      generation({ responseId: 'resp-ag-0002', model: 'Gemini Test Pro (High)', steps: [3], usage: { input: 40, thinking: 5, response: 7 } }),
      generation({ responseId: 'resp-ag-0003', model: 'Gemini Test Pro (High)', createdAt: '2026-10-06T09:05:00.000Z', usage: {} }),
      generation({ model: 'Gemini Test Pro (High)', createdAt: '2026-10-06T09:06:00.000Z', usage: { input: 10, output: 1 } }),
      generation({ responseId: 'resp-ag-0001', model: 'Gemini Test Pro (High)', createdAt: '2026-10-06T09:00:00.000Z', usage: { input: 900, output: 160 } }),
    ],
    steps: [{ idx: 3, metadata: stepMetadata('2026-10-06T09:02:00.000Z') }],
  };

  it('reads exact usage from gen_metadata and skips rows without usage or a response id', async () => {
    (await createConversation(dbPath, rows)).close();
    const records = (await antigravitySource.parse(dbPath)) ?? [];
    expect(records).toEqual([
      {
        source: 'antigravity',
        recordId: `${ANTIGRAVITY_CASCADE}:resp-ag-0001`,
        model: 'Gemini Test Pro (High)',
        occurredAt: '2026-10-06T09:00:00.000Z',
        inputTokens: 900,
        outputTokens: 160,
        cacheReadTokens: 3000,
        cacheWriteTokens: 50,
        reasoningTokens: 60,
      },
      {
        source: 'antigravity',
        recordId: `${ANTIGRAVITY_CASCADE}:resp-ag-0002`,
        model: 'Gemini Test Pro (High)',
        occurredAt: '2026-10-06T09:02:00.000Z',
        inputTokens: 40,
        outputTokens: 12,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 5,
      },
    ]);
  });

  it('opens a checkpointed database immutable without creating any side files', async () => {
    (await createConversation(dbPath, rows, true)).close();
    const before = await readdir(join(dbPath, '..'));
    const result = await scanLocal({ env: {}, home: root, cachePath: null });
    expect(result.files.antigravity).toBe(1);
    expect(result.records.filter((record) => record.source === 'antigravity')).toHaveLength(2);
    expect(await readdir(join(dbPath, '..'))).toEqual(before);
  });

  it('reads rows still in the write ahead log from a private copy, leaving the originals untouched', async () => {
    const writer = await createConversation(dbPath, rows, true);
    const files = ['', '-wal', '-shm'].map((suffix) => `${dbPath}${suffix}`);
    const before = await Promise.all(files.map(async (file) => (await stat(file)).mtimeMs));
    const records = (await antigravitySource.parse(dbPath)) ?? [];
    const after = await Promise.all(files.map(async (file) => (await stat(file)).mtimeMs));
    writer.close();
    expect(records).toHaveLength(2);
    expect(after).toEqual(before);
  });

  it('discovers conversations stored in T3 Code provider sandboxes', async () => {
    const t3Path = join(root, '.t3', 'userdata', 'providers', 'antigravity', 'test-instance', 'antigravity-acp', 'conversations', `${ANTIGRAVITY_CASCADE}.db`);
    (await createConversation(t3Path, rows)).close();
    const result = await scanLocal({ env: {}, home: root, cachePath: null });
    expect(result.files.antigravity).toBe(1);
    expect(result.records.filter((record) => record.source === 'antigravity')).toHaveLength(2);
  });

  it('honors T3_USERDATA when discovering T3 Code provider sandboxes', async () => {
    const customUserdata = join(root, 'custom-t3-userdata');
    const t3Path = join(customUserdata, 'providers', 'antigravity', 'test-instance', 'antigravity-acp', 'conversations', `${ANTIGRAVITY_CASCADE}.db`);
    (await createConversation(t3Path, rows)).close();
    const result = await scanLocal({ env: { T3_USERDATA: customUserdata }, home: root, cachePath: null });
    expect(result.files.antigravity).toBe(1);
    expect(result.records.filter((record) => record.source === 'antigravity')).toHaveLength(2);
  });
  it('falls back to root request id when chat usage response id is omitted', async () => {
    const fallbackRows = {
      generations: [
        generation({
          requestId: 'req-root-fallback-0001',
          model: 'Gemini Test Pro (High)',
          createdAt: '2026-10-06T09:00:00.000Z',
          usage: { input: 500, output: 80 },
        }),
      ],
      steps: [],
    };
    (await createConversation(dbPath, fallbackRows)).close();
    const records = (await antigravitySource.parse(dbPath)) ?? [];
    expect(records).toEqual([
      {
        source: 'antigravity',
        recordId: `${ANTIGRAVITY_CASCADE}:req-root-fallback-0001`,
        model: 'Gemini Test Pro (High)',
        occurredAt: '2026-10-06T09:00:00.000Z',
        inputTokens: 500,
        outputTokens: 80,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    ]);
  });
});
