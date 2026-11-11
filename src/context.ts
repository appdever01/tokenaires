import { execFile, spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { resolve } from 'node:path';

export interface Output {
  line(text?: string): void;
  error(text: string): void;
}

export interface Terminal {
  interactive: boolean;
  width(): number;
  write(text: string): void;
  onInterrupt(cleanup: () => void): () => void;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type Runner = (command: string, args: string[]) => Promise<RunResult>;

export function commandInvocation(command: string, args: string[], platform: NodeJS.Platform): { command: string; args: string[] } {
  const windowsPackageManager = platform === 'win32' && (command === 'npm' || command === 'pnpm');
  return windowsPackageManager
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', `${command}.cmd ${args.join(' ')}`] }
    : { command, args };
}

export interface Context {
  env: NodeJS.ProcessEnv;
  home: string;
  platform: NodeJS.Platform;
  hostname: string;
  nodePath: string;
  scriptPath: string;
  invokedPath: string;
  out: Output;
  term: Terminal;
  fetch: typeof fetch;
  sleep(ms: number): Promise<void>;
  openUrl(url: string): void;
  run: Runner;
  restart(scriptPath: string, args: string[]): Promise<number | null>;
  now(): number;
}

export const runCommand: Runner = (command, args) =>
  new Promise((resolve) => {
    const invocation = commandInvocation(command, args, process.platform);
    execFile(invocation.command, invocation.args, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      resolve({ code, stdout, stderr });
    });
  });

function openerFor(platform: NodeJS.Platform): string | null {
  if (platform === 'darwin') return 'open';
  if (platform === 'linux') return 'xdg-open';
  return null;
}

function resolveScript(path: string | undefined): string {
  if (!path) return '';
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

const DEFAULT_WIDTH = 80;
const INTERRUPTED_EXIT_CODE = 130;

function isInteractive(stream: NodeJS.WriteStream, env: NodeJS.ProcessEnv): boolean {
  return stream.isTTY && !env.CI && env.TERM !== 'dumb';
}

export function createTerminal(stream: NodeJS.WriteStream, env: NodeJS.ProcessEnv): Terminal {
  return {
    interactive: isInteractive(stream, env),
    width: () => stream.columns || DEFAULT_WIDTH,
    write: (text) => {
      stream.write(text);
    },
    onInterrupt: (cleanup) => {
      const handler = (): void => {
        cleanup();
        process.exit(INTERRUPTED_EXIT_CODE);
      };
      process.once('SIGINT', handler);
      return () => {
        process.off('SIGINT', handler);
      };
    },
  };
}

export function createContext(): Context {
  const platform = process.platform;
  const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
  return {
    env: process.env,
    home: homedir(),
    platform,
    hostname: hostname(),
    nodePath: process.execPath,
    scriptPath: resolveScript(process.argv[1]),
    invokedPath,
    out: {
      line: (text = '') => {
        process.stdout.write(`${text}\n`);
      },
      error: (text) => {
        process.stderr.write(`${text}\n`);
      },
    },
    term: createTerminal(process.stderr, process.env),
    fetch: globalThis.fetch.bind(globalThis),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    openUrl: (url) => {
      const opener = openerFor(platform);
      if (!opener) return;
      execFile(opener, [url], () => undefined).on('error', () => undefined);
    },
    run: runCommand,
    restart: (scriptPath, args) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [scriptPath || invokedPath, ...args], {
          env: { ...process.env, TOKENAIRES_UPDATE_RESTART: '1' },
          stdio: 'inherit',
        });
        child.once('error', () => {
          resolve(null);
        });
        child.once('close', (code) => {
          resolve(code ?? 1);
        });
      }),
    now: () => Date.now(),
  };
}
