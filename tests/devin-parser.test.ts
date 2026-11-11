import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { devinRecordId, parseDevinContent, parseDevinFile } from '@/parsers/devin';
import { devinSource } from '@/sources/devin';
import { makeDevinTranscript } from './fixtures/devin';

describe('Devin parser', () => {
  it('parses ATIF trajectory and extracts usage records from agent steps', async () => {
    const transcript = makeDevinTranscript({
      sessionId: 'test-session-001',
      steps: [
        {
          stepId: 1,
          source: 'system',
          timestamp: '2026-11-09T12:00:00.000Z',
        },
        {
          stepId: 2,
          source: 'user',
          timestamp: '2026-11-09T12:01:00.000Z',
        },
        {
          stepId: 3,
          source: 'agent',
          timestamp: '2026-11-09T12:02:00.000Z',
          generationModel: 'swe-2-flash-medium',
          metrics: {
            promptTokens: 15000,
            completionTokens: 250,
            cachedTokens: 8000,
          },
        },
        {
          stepId: 4,
          source: 'agent',
          timestamp: '2026-11-09T12:03:00.000Z',
          metrics: {
            promptTokens: 18000,
            completionTokens: 300,
            cachedTokens: 12000,
          },
        },
      ],
    });

    const records = parseDevinContent(transcript);
    expect(records).not.toBeNull();
    expect(records).toHaveLength(2);

    const r1 = records!.find((r) => r.recordId === 'test-session-001:3');
    expect(r1).toBeDefined();
    expect(r1!.source).toBe('devin');
    expect(r1!.model).toBe('swe-2-flash-medium');
    expect(r1!.occurredAt).toBe('2026-11-09T12:02:00.000Z');
    expect(r1!.inputTokens).toBe(15000);
    expect(r1!.outputTokens).toBe(250);
    expect(r1!.cacheReadTokens).toBe(8000);
    expect(r1!.cacheWriteTokens).toBe(0);

    const r2 = records!.find((r) => r.recordId === 'test-session-001:4');
    expect(r2).toBeDefined();
    expect(r2!.model).toBe('swe-2-flash-medium');
    expect(r2!.outputTokens).toBe(300);
  });

  it('skips steps without completion tokens or without metrics', () => {
    const transcript = makeDevinTranscript({
      sessionId: 'session-zero-tokens',
      steps: [
        {
          stepId: 1,
          source: 'agent',
          timestamp: '2026-11-09T12:00:00.000Z',
          metrics: {
            promptTokens: 1000,
            completionTokens: 0,
          },
        },
        {
          stepId: 2,
          source: 'agent',
          timestamp: '2026-11-09T12:01:00.000Z',
        },
      ],
    });

    const records = parseDevinContent(transcript);
    expect(records).toEqual([]);
  });

  it('validates devin record ids against native pattern', () => {
    expect(devinRecordId('highly-baroness', 10)).toBe('highly-baroness:10');
    expect(devinRecordId('tarry-sage', 'step-42')).toBe('tarry-sage:step-42');
    expect(devinRecordId('', 1)).toBeNull();
    expect(devinRecordId('short', 1)).toBeNull();
  });

  it('discovers transcript files and respects DEVIN_SESSIONS_DIR', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'devin-test-'));
    const transcriptsDir = join(dir, 'transcripts');
    await mkdir(transcriptsDir, { recursive: true });

    const sessionFile = join(transcriptsDir, 'session-abc.json');
    await writeFile(
      sessionFile,
      makeDevinTranscript({
        sessionId: 'session-abc',
        steps: [
          {
            stepId: 1,
            source: 'agent',
            timestamp: '2026-11-09T12:00:00.000Z',
            metrics: { promptTokens: 500, completionTokens: 50 },
          },
        ],
      }),
    );

    try {
      const discovered = await devinSource.discover({
        home: dir,
        env: { DEVIN_SESSIONS_DIR: dir },
        platform: 'linux',
      });
      expect(discovered).toContain(sessionFile);

      const parsed = await parseDevinFile(sessionFile);
      expect(parsed).toHaveLength(1);
      expect(parsed![0].recordId).toBe('session-abc:1');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns empty array or null for corrupted transcripts', () => {
    expect(parseDevinContent('not valid json')).toBeNull();
    expect(parseDevinContent('{}')).toBeNull();
    expect(parseDevinContent(JSON.stringify({ session_id: 'sess-1' }))).toEqual([]);
  });
});
