import { join } from 'node:path';
import { ENV_KEYS, readEnv } from '@/config';
import { listDir } from '@/files/walk';
import { wslHomes } from '@/files/wsl';
import { parseZedFile, zedSignature } from '@/parsers/zed';
import { expandHome } from '@/parsers/paths';
import type { LogSource, SourceContext } from '@/sources/types';

const DB_NAME = 'threads.db';

export function zedDataDirs(ctx: SourceContext): string[] {
  const configured = readEnv(ctx.env, ENV_KEYS.zedHome);
  if (configured) return [expandHome(configured, ctx.home)];

  if (ctx.platform === 'darwin') {
    return [join(ctx.home, 'Library', 'Application Support', 'Zed', 'threads')];
  }
  if (ctx.platform === 'win32') {
    const localAppData = readEnv(ctx.env, 'LOCALAPPDATA') ?? join(ctx.home, 'AppData', 'Local');
    return [join(localAppData, 'Zed', 'threads')];
  }
  const xdgData = readEnv(ctx.env, ENV_KEYS.xdgData);
  const dirs = [join(ctx.home, '.local', 'share', 'zed', 'threads')];
  return xdgData ? [...new Set([...dirs, join(xdgData, 'zed', 'threads')])] : dirs;
}

async function candidateDirs(ctx: SourceContext): Promise<string[]> {
  const base = zedDataDirs(ctx);
  if (readEnv(ctx.env, ENV_KEYS.zedHome)) return base;
  const homes = await wslHomes(ctx.platform);
  return [...base, ...homes.map((home) => join(home, '.local', 'share', 'zed', 'threads'))];
}

export const zedSource: LogSource = {
  source: 'zed',
  async discover(ctx) {
    const dirs = await candidateDirs(ctx);
    const discovered: string[] = [];
    for (const dir of dirs) {
      const files = await listDir(dir);
      for (const file of files) {
        if (file === DB_NAME) {
          discovered.push(join(dir, file));
        }
      }
    }
    return discovered;
  },
  parse: parseZedFile,
  signature: zedSignature,
};
