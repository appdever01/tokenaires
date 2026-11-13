import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readGrokBuildLog } from '@/parsers/grok-build';
import { grokBuildSource } from '@/sources/grok-build';
import { GROK_LINES, GROK_PROMPT_ID, GROK_SESSION_ID, GROK_TIMESTAMP } from './fixtures/grok-build';
import { makeTempDir, removeDir, writeLines } from './helpers/temp';

describe('Grok Build parser', () => {
  let root = '';

  beforeEach(async () => {
    root = await makeTempDir('grok-build');
  });

  afterEach(async () => {
    await removeDir(root);
  });

  it('emits exact prompt and model aggregates, splitting cached input', () => {
    expect(readGrokBuildLog(GROK_LINES.join('\n'))).toEqual([
      {
        source: 'grok-build',
        recordId: `${GROK_PROMPT_ID}:grok-4.7`,
        model: 'grok-4.7',
        occurredAt: new Date(GROK_TIMESTAMP).toISOString(),
        inputTokens: 60,
        outputTokens: 20,
        cacheReadTokens: 30,
        cacheWriteTokens: 10,
        reasoningTokens: 5,
      },
      {
        source: 'grok-build',
        recordId: `${GROK_PROMPT_ID}:grok-4.6`,
        model: 'grok-4.6',
        occurredAt: new Date(GROK_TIMESTAMP).toISOString(),
        inputTokens: 40,
        outputTokens: 8,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    ]);
  });

  it.each(['linux', 'darwin', 'win32'] as const)('discovers the default session root on %s', async (platform) => {
    const home = join(root, platform);
    const session = join(home, '.grok', 'sessions', 'workspace', GROK_SESSION_ID);
    const updates = join(session, 'updates.jsonl');
    await writeLines(updates, GROK_LINES);
    await writeFile(join(session, 'summary.json'), JSON.stringify({ session_kind: 'main' }));

    expect(await grokBuildSource.discover({ home, env: {}, platform })).toEqual([updates]);
  });

  it('uses GROK_HOME and excludes every subagent session kind', async () => {
    const base = join(root, 'custom-grok');
    const parent = join(base, 'sessions', 'workspace', GROK_SESSION_ID);
    const parentLog = join(parent, 'updates.jsonl');
    await writeLines(parentLog, GROK_LINES);
    await writeFile(join(parent, 'summary.json'), JSON.stringify({ session_kind: 'main' }));
    for (const kind of ['subagent', 'subagent_fork', 'subagent_resume']) {
      const child = join(base, 'sessions', 'workspace', kind);
      await mkdir(child, { recursive: true });
      await writeLines(join(child, 'updates.jsonl'), GROK_LINES);
      await writeFile(join(child, 'summary.json'), JSON.stringify({ session_kind: kind }));
    }

    expect(
      await grokBuildSource.discover({ home: root, env: { GROK_HOME: base }, platform: 'linux' }),
    ).toEqual([parentLog]);
  });

  it('fails closed when session metadata is missing', async () => {
    const updates = join(root, '.grok', 'sessions', 'workspace', GROK_SESSION_ID, 'updates.jsonl');
    await writeLines(updates, GROK_LINES);

    await expect(
    grokBuildSource.discover({ home: root, env: {}, platform: 'linux' }),
    ).rejects.toThrow();
  });
});
