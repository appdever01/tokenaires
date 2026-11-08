import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseZedFile, parseZedPayload } from '@/parsers/zed';
import { zedSource } from '@/sources/zed';
import { makeZedDb } from './fixtures/zed';

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
      const base = { source: 'zed', model: 'claude-3-5-sonnet', occurredAt: '2026-09-10T17:54:49.272Z', reasoningTokens: 0 };
      expect(records).toEqual([
        { ...base, recordId: 'thread-1:msg-1', inputTokens: 1500, outputTokens: 250, cacheReadTokens: 800, cacheWriteTokens: 200 },
        { ...base, recordId: 'thread-1:msg-2', inputTokens: 300, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 },
      ]);
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

  it('skips context overflow placeholders that carry no output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zed-test-'));
    const dbPath = join(dir, 'threads.db');
    try {
      makeZedDb(dbPath, [
        {
          id: '8e484826-f0f6-42bf-8b71-c9d22bd35c5c',
          updatedAt: '2026-09-10T17:54:49.272Z',
          model: 'claude-sonnet-4-5',
          requestUsage: {
            '01d380b8-79b4-447e-a6fb-a8300858a7ae': { input_tokens: 200_000 },
            '5b1c2d3e-79b4-447e-a6fb-a8300858a7ae': { input_tokens: 900, output_tokens: 40 },
          },
        },
      ]);
      const records = await parseZedFile(dbPath);
      expect(records?.map((record) => record.recordId)).toEqual(['8e484826-f0f6-42bf-8b71-c9d22bd35c5c:5b1c2d3e-79b4-447e-a6fb-a8300858a7ae']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('drops ids the server would refuse instead of rewriting them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zed-test-'));
    const dbPath = join(dir, 'threads.db');
    try {
      makeZedDb(dbPath, [
        {
          id: 'thread with spaces',
          updatedAt: '2026-09-10T17:54:49.272Z',
          model: 'gpt-5',
          requestUsage: { 'msg-1': { input_tokens: 10, output_tokens: 10 } },
        },
      ]);
      expect(await parseZedFile(dbPath)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('finds threads.db under the platform data folders', async () => {
    const home = await mkdtemp(join(tmpdir(), 'zed-home-'));
    const { mkdir } = await import('node:fs/promises');
    const places = {
      darwin: join(home, 'Library', 'Application Support', 'Zed', 'threads'),
      linux: join(home, '.local', 'share', 'zed', 'threads'),
      flatpak: join(home, '.var', 'app', 'dev.zed.Zed', 'data', 'zed', 'threads'),
      custom: join(home, 'zed-data', 'threads'),
    };
    for (const dir of Object.values(places)) {
      await mkdir(dir, { recursive: true });
      makeZedDb(join(dir, 'threads.db'), []);
    }
    try {
      expect(await zedSource.discover({ home, env: {}, platform: 'darwin' })).toEqual([join(places.darwin, 'threads.db')]);
      expect(await zedSource.discover({ home, env: {}, platform: 'linux' })).toEqual([
        join(places.linux, 'threads.db'),
        join(places.flatpak, 'threads.db'),
      ]);
      expect(await zedSource.discover({ home, env: { ZED_HOME: join(home, 'zed-data') }, platform: 'linux' })).toEqual([
        join(places.custom, 'threads.db'),
      ]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('handles corrupted payloads gracefully', () => {
    const corrupted = Buffer.from('not valid zstd data');
    expect(parseZedPayload(corrupted, 'zstd')).toBeNull();
  });
});
