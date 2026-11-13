import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { findAll, type FileFilter } from '@/files/walk';
import { parseObject, text } from '@/parsers/json';
import { parseGrokBuildFile } from '@/parsers/grok-build';
import { grokBuildSessionsRoot } from '@/parsers/paths';
import type { LogSource, SourceContext } from '@/sources/types';

const isUpdateLog: FileFilter = (_path, name) => name === 'updates.jsonl';

async function isSubagentSession(updatePath: string): Promise<boolean> {
  const summaryPath = join(dirname(updatePath), 'summary.json');
  const summary = parseObject(await readFile(summaryPath, 'utf8'));
  if (!summary) throw new Error(`Grok Build session summary is not valid JSON: ${summaryPath}`);
  const kind = text(summary, 'session_kind');
  return kind === 'subagent' || kind === 'subagent_fork' || kind === 'subagent_resume';
}

export const grokBuildSource: LogSource = {
  source: 'grok-build',
  async discover(ctx: SourceContext) {
    const files = await findAll([grokBuildSessionsRoot(ctx.env, ctx.home)], isUpdateLog);
    const discovered: string[] = [];
    for (const file of files) {
      if (!(await isSubagentSession(file))) discovered.push(file);
    }
    return discovered;
  },
  parse: parseGrokBuildFile,
};
