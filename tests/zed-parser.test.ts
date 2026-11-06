import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseZedFile, parseZedPayload, readZedDb } from '@/parsers/zed';
import { zedSource } from '@/sources/zed';
import { makeZedDb } from './fixtures/zed';
import { DatabaseSync } from 'node:sqlite';

describe('Zed parser', () => {
  it('parses decompressed thread payload and extracts usage records', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zed-test-'));
    const dbPath = join(dir, 'threads.db');

    try {
      makeZedDb(dbPath, [
        {
          id: 'thread-1',
          updatedAt: '2026-09-10T17:54:49.272Z',
          model: 'claude-3-5-sonnet',
          requestUsage: {
            'msg-1': {
              input_tokens: 1500,
              output_tokens: 250,
              cache_read_input_tokens: 800,
              cache_creation_input_tokens: 200,
            },
            'msg-2': {
              input_tokens: 300,
              output_tokens: 50,
            },
          },
        },
      ]);

      const records = await parseZedFile(dbPath);
      expect(records).not.toBeNull();
      expect(records).toHaveLength(2);

      const r1 = records!.find((r) => r.recordId === 'thread-1:msg-1');
      expect(r1).toBeDefined();
      expect(r1!.source).toBe('zed');
      expect(r1!.model).toBe('claude-3-5-sonnet');
      expect(r1!.occurredAt).toBe('2026-09-10T17:54:49.272Z');
      expect(r1!.inputTokens).toBe(1500);
      expect(r1!.outputTokens).toBe(250);
      expect(r1!.cacheReadTokens).toBe(800);
      expect(r1!.cacheWriteTokens).toBe(200);

      const r2 = records!.find((r) => r.recordId === 'thread-1:msg-2');
      expect(r2).toBeDefined();
      expect(r2!.inputTokens).toBe(300);
      expect(r2!.outputTokens).toBe(50);
      expect(r2!.cacheReadTokens).toBe(0);
      expect(r2!.cacheWriteTokens).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('skips threads without models or without usage tokens', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zed-test-'));
    const dbPath = join(dir, 'threads.db');

    try {
      makeZedDb(dbPath, [
        {
          id: 'thread-no-model',
          updatedAt: '2026-09-10T17:54:49.272Z',
          requestUsage: {
            'msg-1': { input_tokens: 100, output_tokens: 100 },
          },
        },
        {
          id: 'thread-zero-tokens',
          updatedAt: '2026-09-10T17:54:49.272Z',
          model: 'claude-3-5-sonnet',
          requestUsage: {
            'msg-1': { input_tokens: 0, output_tokens: 0 },
          },
        },
      ]);

      const records = await parseZedFile(dbPath);
      expect(records).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('discovers threads.db in candidate folders and respects ZED_HOME', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zed-test-'));
    const zedThreadsDir = join(dir, 'custom-zed', 'threads');
    const dbPath = join(zedThreadsDir, 'threads.db');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(zedThreadsDir, { recursive: true });

    makeZedDb(dbPath, [
      {
        id: 't-custom',
        updatedAt: '2026-09-10T17:54:49.272Z',
        model: 'gpt-4o',
        requestUsage: {
          'm-1': { input_tokens: 50, output_tokens: 50 },
        },
      },
    ]);

    try {
      const discovered = await zedSource.discover({
        home: dir,
        env: { ZED_HOME: zedThreadsDir },
        platform: 'linux',
      });
      expect(discovered).toContain(dbPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('handles corrupted payloads gracefully', () => {
    const corrupted = Buffer.from('not valid zstd data');
    expect(parseZedPayload(corrupted, 'zstd')).toBeNull();
  });
});
