import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UsageRecord } from '@tokenaires/contracts';
import { parseZcodeFile, zcodeTokens } from '@/parsers/zcode';
import { zcodeRoots } from '@/parsers/paths';
import { scanLocal } from '@/scan';
import { ZCODE_MODEL_PRIORITY, ZCODE_NO_REQUEST_ID, ZCODE_OTHER_REQUEST, ZCODE_REQUEST, ZCODE_SECRET, modelIoLine, zcodeMainSession, zcodeOtherSession } from './fixtures/zcode';
import { makeTempDir, removeDir, writeLines } from './helpers/temp';

describe('ZCode parser', () => {
  let root = '';
  beforeEach(async () => {
    root = await makeTempDir('zcode');
  });
  afterEach(async () => {
    await removeDir(root);
  });

  it('parses model_io usage, folds retry attempts and prefers the response model id', async () => {
    const path = `${root}/model-io-sess_main.jsonl`;
    await writeLines(path, zcodeMainSession);
    const records = (await parseZcodeFile(path)) ?? [];
    const into = new Map<string, UsageRecord>(records.map((record) => [record.recordId, record]));
    expect(into.size).toBe(3);
    expect(into.get(ZCODE_REQUEST)).toEqual({
      source: 'zcode',
      recordId: ZCODE_REQUEST,
      model: 'glm-5.3',
      occurredAt: '2026-10-01T10:00:05.000Z',
      inputTokens: 10,
      outputTokens: 50,
      cacheReadTokens: 1000,
      cacheWriteTokens: 0,
      reasoningTokens: 20,
    });
    expect(into.get(ZCODE_NO_REQUEST_ID)?.outputTokens).toBe(7);
    expect(into.get(ZCODE_MODEL_PRIORITY)?.model).toBe('glm-5.3-flash');
  });

  it('skips failed attempts, zero usage, malformed lines and never leaks request text', async () => {
    const path = `${root}/model-io-sess_main.jsonl`;
    await writeLines(path, zcodeMainSession);
    const records = (await parseZcodeFile(path)) ?? [];
    expect(records.some((record) => record.recordId.startsWith('f') || record.recordId.startsWith('e'))).toBe(false);
    expect(JSON.stringify(records)).not.toContain(ZCODE_SECRET);
    expect(JSON.stringify(records)).not.toContain('usage report written');
  });

  it('discovers rollout files and dedupes the same request id across overlapping roots', async () => {
    await writeLines(`${root}/.zcode/cli/rollout/model-io-sess_main.jsonl`, zcodeMainSession);
    await writeLines(`${root}/.zcode/cli/rollout/model-io-sess_other.jsonl`, zcodeOtherSession);
    await writeLines(`${root}/.config/zcode/cli/rollout/model-io-sess_main.jsonl`, zcodeMainSession);
    const result = await scanLocal({ env: {}, home: root, cachePath: null });
    const zcode = result.records.filter((record) => record.source === 'zcode');
    expect(result.files['zcode']).toBe(3);
    expect(zcode.map((record) => record.recordId).sort()).toEqual(
      [ZCODE_MODEL_PRIORITY, ZCODE_OTHER_REQUEST, ZCODE_REQUEST, ZCODE_NO_REQUEST_ID].sort(),
    );
  });

  it('splits cached tokens out of input and counts reasoning once', () => {
    expect(zcodeTokens({ inputTokens: 1200, outputTokens: 80, totalTokens: 1280, cacheReadTokens: 1000, reasoningTokens: 30 })).toEqual({
      inputTokens: 200,
      outputTokens: 80,
      cacheReadTokens: 1000,
      cacheWriteTokens: 0,
      reasoningTokens: 30,
    });
    expect(zcodeTokens({ inputTokens: 10, outputTokens: 50, totalTokens: 60, cacheReadTokens: 1000 })).toMatchObject({
      inputTokens: 10,
      cacheReadTokens: 1000,
    });
    expect(
      zcodeTokens({
        inputTokens: 900,
        outputTokens: 40,
        inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 700, cacheWriteTokens: 100 },
        outputTokenDetails: { reasoningTokens: 15 },
      }),
    ).toEqual({ inputTokens: 100, outputTokens: 40, cacheReadTokens: 700, cacheWriteTokens: 100, reasoningTokens: 15 });
    expect(zcodeTokens({ inputTokens: 100, outputTokens: 40, totalTokens: 160, reasoningTokens: 20 })).toMatchObject({
      outputTokens: 60,
      reasoningTokens: 20,
    });
    expect(zcodeTokens({ inputTokens: 100, outputTokens: 10, reasoningTokens: 25 })).toMatchObject({ outputTokens: 35, reasoningTokens: 25 });
  });

  it('never falls back to a bare timestamp as the record id', async () => {
    const path = `${root}/model-io-sess_bare.jsonl`;
    const line = JSON.parse(modelIoLine({ output: 9 })) as Record<string, unknown>;
    delete line.sessionId;
    await writeLines(path, [JSON.stringify(line)]);
    expect(await parseZcodeFile(path)).toEqual([]);
  });

  it('reads both default locations unless ZCODE_CONFIG_DIR is set', () => {
    expect(zcodeRoots({}, '/home/me')).toEqual(['/home/me/.zcode/cli/rollout', '/home/me/.config/zcode/cli/rollout']);
    expect(zcodeRoots({ ZCODE_CONFIG_DIR: '/a, /b' }, '/home/me')).toEqual(['/a/cli/rollout', '/b/cli/rollout']);
    expect(zcodeRoots({ ZCODE_CONFIG_DIR: '~/one,~/two' }, '/home/me')).toEqual(['/home/me/one/cli/rollout', '/home/me/two/cli/rollout']);
    expect(zcodeRoots({ XDG_CONFIG_HOME: '/xdg' }, '/home/me')).toContain('/xdg/zcode/cli/rollout');
  });
});
