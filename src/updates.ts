import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Context } from '@/context';
import { CLI_VERSION, CONFIG_DIR_MODE, CONFIG_FILE_MODE } from '@/config';
import { parseObject } from '@/parsers/json';
import { configPath } from '@/store';

const REGISTRY_URL = 'https://registry.npmjs.org/tokenaires/latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 2500;
const RESTART_MARKER = 'TOKENAIRES_UPDATE_RESTART';

export type Installer = 'npm' | 'pnpm' | 'bun';

interface UpdateState {
  autoUpdate: boolean;
  checkedAt: number;
  latestVersion: string | null;
  installer: Installer | null;
  installPath: string | null;
}

function updateStatePath(ctx: Context): string {
  return join(dirname(configPath(ctx.env, ctx.home)), 'updates.json');
}

function parseState(value: string): UpdateState | null {
  try {
    const parsed = parseObject(value);
    if (!parsed || typeof parsed.autoUpdate !== 'boolean' || typeof parsed.checkedAt !== 'number') return null;
    if (typeof parsed.latestVersion !== 'string' && parsed.latestVersion !== null) return null;
    const installer = parsed.installer === 'npm' || parsed.installer === 'pnpm' || parsed.installer === 'bun' ? parsed.installer : null;
    const installPath = typeof parsed.installPath === 'string' ? parsed.installPath : null;
    return { autoUpdate: parsed.autoUpdate, checkedAt: parsed.checkedAt, latestVersion: parsed.latestVersion, installer, installPath };
  } catch {
    return null;
  }
}

async function loadState(ctx: Context): Promise<UpdateState> {
  try {
    return parseState(await readFile(updateStatePath(ctx), 'utf8')) ?? { autoUpdate: false, checkedAt: 0, latestVersion: null, installer: null, installPath: null };
  } catch {
    return { autoUpdate: false, checkedAt: 0, latestVersion: null, installer: null, installPath: null };
  }
}

async function saveState(ctx: Context, state: UpdateState): Promise<void> {
  const path = updateStatePath(ctx);
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: CONFIG_DIR_MODE });
  await chmod(dir, CONFIG_DIR_MODE);
  await writeFile(path, `${JSON.stringify(state)}\n`, { mode: CONFIG_FILE_MODE });
  await chmod(path, CONFIG_FILE_MODE);
}

export async function setAutoUpdate(ctx: Context, enabled: boolean): Promise<void> {
  const state = await loadState(ctx);
  await saveState(ctx, { ...state, autoUpdate: enabled });
  ctx.out.line(`  Automatic updates ${enabled ? 'enabled' : 'disabled'}.`);
}

export async function autoUpdateEnabled(ctx: Context): Promise<boolean> {
  return (await loadState(ctx)).autoUpdate;
}

function normalizedPath(path: string): string {
  return `/${path.replace(/\\/g, '/')}`.replace(/\/+/g, '/').replace(/^\/\?\//, '/').toLowerCase();
}

function isTemporaryRun(path: string): boolean {
  const normalized = normalizedPath(path);
  return /\/(?:_npx|_bunx|dlx|bunx)(?:\/|$)/.test(normalized) || /\/\.bun\/install\/cache\//.test(normalized);
}

export function detectInstaller(scriptPath: string): Installer | null {
  const path = normalizedPath(scriptPath);
  if (isTemporaryRun(path)) return null;
  if (/\/\.pnpm\/tokenaires@[^/]+\/node_modules\/tokenaires\//.test(path) && /\/global\/\d+\/node_modules\//.test(path)) return 'pnpm';
  if (/\/global\/v?\d+(?:\.\d+)?\/[^/]+\/node_modules\/tokenaires\//.test(path)) return 'pnpm';
  if (/\/\.bun\/install\/global\/node_modules\/tokenaires\//.test(path)) return 'bun';
  if (/\/lib\/node_modules\/tokenaires\//.test(path) || /\/npm\/node_modules\/tokenaires\//.test(path)) return 'npm';
  return null;
}

function isInsidePackageRoot(scriptPath: string, root: string, installer: Installer): boolean {
  const path = normalizedPath(scriptPath);
  const normalizedRoot = normalizedPath(root).replace(/\/+$/, '');
  const relativePath = path.slice(normalizedRoot.length);
  return relativePath.startsWith('/tokenaires/') || (installer === 'pnpm' && /^\/\.pnpm\/tokenaires@[^/]+\/node_modules\/tokenaires\//.test(relativePath));
}

function packageRoot(scriptPath: string): string {
  return dirname(dirname(scriptPath));
}

function samePath(left: string, right: string): boolean {
  return normalizedPath(left).replace(/\/+$/, '') === normalizedPath(right).replace(/\/+$/, '');
}

async function rememberInstaller(ctx: Context, installer: Installer, scriptPath = ctx.scriptPath): Promise<Installer> {
  let installedPath = scriptPath;
  try {
    installedPath = realpathSync(scriptPath);
  } catch {
    // Keep the path reported by the package manager if the test or host cannot resolve it.
  }
  const installPath = packageRoot(installedPath);
  const state = await loadState(ctx);
  if (state.installer !== installer || state.installPath !== installPath) {
    await saveState(ctx, { ...state, installer, installPath }).catch(() => undefined);
  }
  return installer;
}

export async function findCliInstaller(ctx: Context, args: string[]): Promise<Installer | null> {
  const command = args[0];
  if ((command && command !== 'sync') || args.includes('--dry-run') || ctx.env[RESTART_MARKER] === '1') return null;
  const knownInstaller = detectInstaller(ctx.scriptPath);
  const installPath = normalizedPath(ctx.scriptPath);
  if (isTemporaryRun(installPath) || !installPath.includes('/node_modules/tokenaires/')) return null;
  if (knownInstaller) return rememberInstaller(ctx, knownInstaller);

  const currentPackageRoot = packageRoot(ctx.scriptPath);
  const previousState = await loadState(ctx);
  if (previousState.installer && previousState.installPath && samePath(previousState.installPath, currentPackageRoot)) return previousState.installer;

  const [npmRoot, pnpmRoot, bunList] = await Promise.all([
    ctx.run('npm', ['root', '--global']).catch(() => null),
    ctx.run('pnpm', ['root', '--global']).catch(() => null),
    ctx.run('bun', ['pm', 'ls', '-g', 'tokenaires']).catch(() => null),
  ]);
  if (npmRoot?.code === 0 && isInsidePackageRoot(ctx.scriptPath, npmRoot.stdout.trim(), 'npm')) return rememberInstaller(ctx, 'npm');
  if (pnpmRoot?.code === 0 && isInsidePackageRoot(ctx.scriptPath, pnpmRoot.stdout.trim(), 'pnpm')) return rememberInstaller(ctx, 'pnpm');
  const bunRoot = bunList?.code === 0 ? bunGlobalRoot(bunList.stdout) : null;
  if (bunRoot && isInsidePackageRoot(ctx.scriptPath, bunRoot, 'bun')) return rememberInstaller(ctx, 'bun');
  return null;
}

function newerVersion(latest: string): boolean {
  const parts = (version: string) => version.replace(/^v/, '').split(/[.+-]/).slice(0, 3).map(Number);
  const currentParts = parts(CLI_VERSION);
  const latestParts = parts(latest);
  if (currentParts.length !== 3 || latestParts.length !== 3 || [...currentParts, ...latestParts].some((part) => !Number.isInteger(part))) return false;
  for (let index = 0; index < 3; index += 1) {
    const latestPart = latestParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (latestPart !== currentPart) return latestPart > currentPart;
  }
  return false;
}

async function latestVersion(ctx: Context, state: UpdateState, signal: AbortSignal): Promise<UpdateState> {
  if (ctx.now() - state.checkedAt < CACHE_TTL_MS) return state;
  let version: string | null = null;
  try {
    const response = await ctx.fetch(REGISTRY_URL, { signal });
    if (response.ok) {
      const result = parseObject(await response.text());
      if (typeof result?.version === 'string') version = result.version;
    }
  } catch {
    version = null;
  }
  if (signal.aborted) return state;
  const updated = { ...state, checkedAt: ctx.now(), latestVersion: version };
  await saveState(ctx, updated).catch(() => undefined);
  return updated;
}

function updateCommand(installer: Installer): string[] {
  if (installer === 'npm') return ['install', '--global', 'tokenaires@latest'];
  return ['add', '--global', 'tokenaires@latest'];
}

function updateHint(installer: Installer): string {
  if (installer === 'npm') return 'npm install -g tokenaires';
  if (installer === 'pnpm') return 'pnpm add -g tokenaires';
  return 'bun add -g tokenaires';
}

function bunGlobalRoot(output: string): string | null {
  const firstLine = output.split('\n')[0]?.replace(/\s+\(\d+ installed\).*$/, '').replace(/ node_modules$/, '/node_modules');
  return firstLine || null;
}

async function updatedCliPath(ctx: Context, installer: Installer): Promise<string | null> {
  try {
    if (installer === 'bun') {
      const result = await ctx.run('bun', ['pm', 'ls', '-g', 'tokenaires']);
      const root = result.code === 0 ? bunGlobalRoot(result.stdout) : null;
      return root ? join(root, 'tokenaires', 'dist', 'cli.js') : null;
    }
    const result = await ctx.run(installer, ['root', '--global']);
    const root = result.stdout.trim();
    return result.code === 0 && root ? join(root, 'tokenaires', 'dist', 'cli.js') : null;
  } catch {
    return null;
  }
}

export interface UpdateCheck {
  result: Promise<UpdateOutcome>;
  cancel(): void;
}

export type UpdateOutcome = { kind: 'none' } | { kind: 'notice'; text: string } | { kind: 'restarted'; exitCode: number };

export function startCliUpdateCheck(ctx: Context, args: string[], installer: Installer | null): UpdateCheck {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, CHECK_TIMEOUT_MS);
  timeout.unref();
  const result = runUpdateCheck(ctx, args, installer, controller.signal).finally(() => {
    clearTimeout(timeout);
  });
  return {
    result,
    cancel: () => {
      controller.abort();
    },
  };
}

async function runUpdateCheck(ctx: Context, args: string[], installer: Installer | null, signal: AbortSignal): Promise<UpdateOutcome> {
  if (!installer) return { kind: 'none' };

  const state = await latestVersion(ctx, await loadState(ctx), signal);
  const latest = state.latestVersion;
  if (!latest || !newerVersion(latest)) return { kind: 'none' };
  const quiet = args.includes('--quiet') || args.includes('-q');

  if (state.autoUpdate) {
    try {
      const result = await ctx.run(installer, updateCommand(installer));
      if (result.code === 0) {
        if (!quiet) ctx.out.line(`  Updated Tokenaires to ${latest}. Restarting sync.`);
        const scriptPath = await updatedCliPath(ctx, installer);
        if (scriptPath) await rememberInstaller(ctx, installer, scriptPath);
        const exitCode = await ctx.restart(scriptPath ?? ctx.invokedPath, args);
        if (exitCode !== null) return { kind: 'restarted', exitCode };
      }
    } catch {
      // An unavailable package manager must not prevent the requested sync.
    }
    if (!quiet) return { kind: 'notice', text: `Tokenaires ${latest} is available, but automatic update failed. Update with: ${updateHint(installer)}` };
    return { kind: 'none' };
  }

  if (!quiet) return { kind: 'notice', text: `Tokenaires ${latest} is available. Update with: ${updateHint(installer)}` };
  return { kind: 'none' };
}
