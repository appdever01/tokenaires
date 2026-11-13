import { appendFile, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanCachePath } from '@/cache/scan-cache';
import { scanLocal } from '@/scan';
import { CLAUDE_CWD, CLAUDE_SECRET, claudeAssistant } from './fixtures/claude';
import { CODEX_SECRET } from './fixtures/codex';
import { GROK_LINES, GROK_SESSION_ID } from './fixtures/grok-build';
import { writeFixtureLogs, type LogDirs } from './helpers/logs';
import { makeTempDir, removeDir, writeLines } from './helpers/temp';

describe('local scan cache', () => {
  let root = '';
  let dirs: LogDirs;
  let env: NodeJS.ProcessEnv;
  let cachePath = '';

  beforeEach(async () => {
    root = await makeTempDir('cache');
    dirs = await writeFixtureLogs(root);
    env = { CLAUDE_CONFIG_DIR: dirs.claudeConfig, CODEX_HOME: dirs.codexHome, XDG_CONFIG_HOME: join(root, 'xdg') };
    cachePath = scanCachePath(env, root) ?? '';
  });
  afterEach(async () => {
    await removeDir(root);
  });

  it('reuses unchanged files on the next scan and returns the same records', async () => {
    const first = await scanLocal({ env, home: root });
    expect(first.cachedFiles).toBe(0);
    expect(cachePath).toBe(join(root, 'xdg', 'tokenaires', 'scan-cache.json.gz'));
    expect((await stat(cachePath)).mode & 0o777).toBe(0o600);
    const second = await scanLocal({ env, home: root });
    expect(second.cachedFiles).toBe(5);
    expect(second.records).toEqual(first.records);
  });

  it('parses a file again once it grows, and forgets deleted files', async () => {
    await scanLocal({ env, home: root });
    const session = join(dirs.claudeConfig, 'projects', '-Users-someone-secret-project', 'session-one.jsonl');
    const usage = { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    await appendFile(session, `${claudeAssistant('msg_011GGGGGGGGGGGGGGGGGGGGG', 'req_011GGGGGGGGGGGGGGGGGGGGG', '2026-10-09T00:00:00.000Z', usage)}\n`);
    await rm(join(dirs.codexHome, 'archived_sessions'), { recursive: true });
    const next = await scanLocal({ env, home: root });
    expect(next.cachedFiles).toBe(2);
    expect(next.records.map((record) => record.recordId)).toContain('msg_011GGGGGGGGGGGGGGGGGGGGG:req_011GGGGGGGGGGGGGGGGGGGGG');
    const cached = JSON.parse(gunzipSync(await readFile(cachePath)).toString('utf8')) as { files: Record<string, unknown> };
    expect(Object.keys(cached.files).some((path) => path.includes('archived_sessions'))).toBe(false);
  });

  it('stores only numbers, ids, models and local paths, never prompt text', async () => {
    await scanLocal({ env, home: root });
    const text = gunzipSync(await readFile(cachePath)).toString('utf8');
    for (const secret of [CLAUDE_SECRET, CODEX_SECRET, CLAUDE_CWD, 'secret-branch', 'codex-secret']) expect(text).not.toContain(secret);
  });

  it('ignores a corrupt cache and can be turned off', async () => {
    await scanLocal({ env, home: root });
    await writeFile(cachePath, 'not gzip');
    const recovered = await scanLocal({ env, home: root });
    expect(recovered.cachedFiles).toBe(0);
    expect(recovered.records).toHaveLength(7);
    expect(scanCachePath({ ...env, TOKENAIRES_NO_CACHE: '1' }, root)).toBeNull();
  });

  it('skips Grok Build logs without valid metadata without aborting the scan', async () => {
    const grokHome = join(root, 'custom-grok');
    const session = join(grokHome, 'sessions', 'workspace', GROK_SESSION_ID);
    await writeLines(join(session, 'updates.jsonl'), GROK_LINES);
    await writeFile(join(session, 'summary.json'), JSON.stringify({ session_kind: 'main' }));
    await writeLines(join(session, 'terminal', 'updates.jsonl'), GROK_LINES);
    const recapRequest = join(grokHome, 'sessions', 'recap_requests');
    await writeLines(join(recapRequest, 'updates.jsonl'), GROK_LINES);
    await writeFile(join(recapRequest, 'summary.json'), '{');

    const result = await scanLocal({ env: { ...env, GROK_HOME: grokHome }, home: root, cachePath: null });

    expect(result.records.some((record) => record.source === 'claude-code')).toBe(true);
    expect(result.records.filter((record) => record.source === 'grok-build')).toHaveLength(2);
    expect(result.files['grok-build']).toBe(1);
  });
});
