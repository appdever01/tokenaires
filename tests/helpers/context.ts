import type { Context, RunResult } from '@/context';

export interface TestContext extends Context {
  lines: string[];
  errors: string[];
  sleeps: number[];
  opened: string[];
  commands: { command: string; args: string[] }[];
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

export function testContext(overrides: Partial<Context> & { home: string; env: NodeJS.ProcessEnv }): TestContext {
  const lines: string[] = [];
  const errors: string[] = [];
  const sleeps: number[] = [];
  const opened: string[] = [];
  const commands: { command: string; args: string[] }[] = [];
  let clock = Date.parse('2026-11-01T00:00:00.000Z');
  const base: Context = {
    platform: 'darwin',
    hostname: 'test-host',
    nodePath: '/usr/local/bin/node',
    scriptPath: '/opt/tokenaires/dist/cli.js',
    invokedPath: '/opt/tokenaires/dist/cli.js',
    out: {
      line: (text = '') => lines.push(stripAnsi(text)),
      error: (text) => errors.push(stripAnsi(text)),
    },
    term: { interactive: false, width: () => 80, write: () => undefined, onInterrupt: () => () => undefined },
    fetch: globalThis.fetch.bind(globalThis),
    sleep: (ms) => {
      sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    openUrl: (url) => opened.push(url),
    run: (command, args): Promise<RunResult> => {
      commands.push({ command, args });
      return Promise.resolve({ code: 0, stdout: '', stderr: '' });
    },
    restart: () => Promise.resolve(0),
    now: () => clock,
    ...overrides,
  };
  return { ...base, lines, errors, sleeps, opened, commands };
}
