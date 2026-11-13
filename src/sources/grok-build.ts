import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { findAll, type FileFilter } from '@/files/walk';
import { parseObject, text } from '@/parsers/json';
import { parseGrokBuildFile } from '@/parsers/grok-build';
import { grokBuildSessionsRoot } from '@/parsers/paths';
import type { LogSource, SourceContext } from '@/sources/types';

const isUpdateLog: FileFilter = (_path, name) => name === 'updates.jsonl';

async function shouldSkipSession(updatePath: string): Promise<boolean> {
  const summaryPath = join(dirname(updatePath), 'summary.json');
  let contents: string;
  try {
    contents = await readFile(summaryPath, 'utf8');
  } catch {
    return true;
  }
  const summary = parseObject(contents);
  if (!summary) return true;
  const kind = text(summary, 'session_kind');
  return kind === 'subagent' || kind === 'subagent_fork' || kind === 'subagent_resume';
}

export const grokBuildSource: LogSource = {
  source: 'grok-build',
  async discover(ctx: SourceContext) {
    const files = await findAll([grokBuildSessionsRoot(ctx.env, ctx.home)], isUpdateLog);
    const discovered: string[] = [];
    for (const file of files) {
      if (!(await shouldSkipSession(file))) discovered.push(file);
    }
    return discovered;
  },
  parse: parseGrokBuildFile,
};
