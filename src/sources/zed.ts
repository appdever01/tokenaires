import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ENV_KEYS, readEnv } from '@/config';
import { wslHomes } from '@/files/wsl';
import { parseZedFile, zedSignature } from '@/parsers/zed';
import { expandHome } from '@/parsers/paths';
import type { LogSource, SourceContext } from '@/sources/types';

const THREADS_DIR = 'threads';
const DB_NAME = 'threads.db';
const FLATPAK_DATA = ['.var', 'app', 'dev.zed.Zed', 'data', 'zed'];

function linuxDataDirs(home: string, xdgData: string | undefined): string[] {
  return [join(xdgData ?? join(home, '.local', 'share'), 'zed'), join(home, '.local', 'share', 'zed'), join(home, ...FLATPAK_DATA)];
}

export function zedDataDirs(ctx: SourceContext): string[] {
  const configured = readEnv(ctx.env, ENV_KEYS.zedHome);
  if (configured) return [expandHome(configured, ctx.home)];
  if (ctx.platform === 'darwin') return [join(ctx.home, 'Library', 'Application Support', 'Zed')];
  if (ctx.platform === 'win32') {
    const localAppData = readEnv(ctx.env, 'LOCALAPPDATA') ?? join(ctx.home, 'AppData', 'Local');
    return [join(localAppData, 'Zed')];
  }
  return [...new Set(linuxDataDirs(ctx.home, readEnv(ctx.env, ENV_KEYS.xdgData)))];
}

async function candidateDirs(ctx: SourceContext): Promise<string[]> {
  const base = zedDataDirs(ctx);
  if (readEnv(ctx.env, ENV_KEYS.zedHome)) return base;
  const homes = await wslHomes(ctx.platform);
  return [...base, ...homes.flatMap((home) => linuxDataDirs(home, undefined))];
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export const zedSource: LogSource = {
  source: 'zed',
  async discover(ctx) {
    const found = new Set<string>();
    for (const dir of await candidateDirs(ctx)) {
      for (const path of [join(dir, THREADS_DIR, DB_NAME), join(dir, DB_NAME)]) {
        if (await isFile(path)) found.add(path);
      }
    }
    return [...found];
  },
  parse: parseZedFile,
  signature: zedSignature,
};
