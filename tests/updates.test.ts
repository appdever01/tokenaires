import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commandInvocation } from '@/context';
import { runCli } from '@/program';
import { detectInstaller, findCliInstaller, setAutoUpdate, startCliUpdateCheck } from '@/updates';
import { makeTempDir, removeDir } from './helpers/temp';
import { testContext } from './helpers/context';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

describe('CLI update checks', () => {
  let home = '';

  beforeEach(async () => {
    home = await makeTempDir('updates');
  });

  afterEach(async () => {
    await removeDir(home);
  });

  it('recognizes supported global installs and skips temporary runners', () => {
    expect(detectInstaller('/usr/local/lib/node_modules/tokenaires/dist/cli.js')).toBe('npm');
    expect(detectInstaller('/home/user/.local/share/pnpm/global/5/node_modules/.pnpm/tokenaires@0.3.0/node_modules/tokenaires/dist/cli.js')).toBe('pnpm');
    expect(detectInstaller('/home/user/.local/share/pnpm/global/v11/abc123/node_modules/tokenaires/dist/cli.js')).toBe('pnpm');
    expect(detectInstaller('/home/user/.bun/install/global/node_modules/tokenaires/dist/cli.js')).toBe('bun');
    expect(detectInstaller('C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\tokenaires\\dist\\cli.js')).toBe('npm');
    expect(detectInstaller('C:\\Users\\me\\AppData\\Local\\pnpm\\global\\v11\\hash\\node_modules\\tokenaires\\dist\\cli.js')).toBe('pnpm');
    expect(detectInstaller('C:\\Users\\me\\.bun\\install\\global\\node_modules\\tokenaires\\dist\\cli.js')).toBe('bun');
    expect(detectInstaller('\\\\?\\C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\tokenaires\\dist\\cli.js')).toBe('npm');
    expect(detectInstaller('/home/user/.npm/_npx/hash/node_modules/tokenaires/dist/cli.js')).toBeNull();
    expect(detectInstaller('/home/user/.cache/pnpm/dlx/hash/node_modules/.pnpm/tokenaires@0.3.0/node_modules/tokenaires/dist/cli.js')).toBeNull();
    expect(detectInstaller('/home/user/.bun/install/cache/tokenaires@0.3.0/dist/cli.js')).toBeNull();
    expect(detectInstaller('/project/node_modules/tokenaires/dist/cli.js')).toBeNull();
  });

  it('runs Windows package-manager shims through cmd.exe', () => {
    expect(commandInvocation('npm', ['install', '--global', 'tokenaires@latest'], 'win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd install --global tokenaires@latest'],
    });
    expect(commandInvocation('pnpm', ['add', '--global', 'tokenaires@latest'], 'win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm.cmd add --global tokenaires@latest'],
    });
    expect(commandInvocation('npm', ['install', '--global', 'tokenaires@latest'], 'linux')).toEqual({
      command: 'npm',
      args: ['install', '--global', 'tokenaires@latest'],
    });
  });

  it('announces a newer version on an interactive sync', async () => {
    let requests = 0;
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/usr/local/lib/node_modules/tokenaires/dist/cli.js',
      fetch: () => {
        requests += 1;
        return Promise.resolve(Response.json({ version: '0.4.0' }));
      },
    });

    await expect(startCliUpdateCheck(ctx, ['sync'], 'npm').result).resolves.toEqual({
      kind: 'notice',
      text: 'Tokenaires 0.4.0 is available. Update with: npm install -g tokenaires',
    });
    expect(requests).toBe(1);
  });

  it('updates and restarts quietly when auto-updates are enabled', async () => {
    let restarts = 0;
    let restartedPath = '';
    const commands: { command: string; args: string[] }[] = [];
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/usr/local/lib/node_modules/tokenaires/dist/cli.js',
      fetch: () => Promise.resolve(Response.json({ version: '0.4.0' })),
      run: (command, args) => {
        commands.push({ command, args });
        return Promise.resolve(args[0] === 'root'
          ? { code: 0, stdout: '/usr/local/lib/node_modules\n', stderr: '' }
          : { code: 0, stdout: '', stderr: '' });
      },
      restart: (scriptPath) => {
        restarts += 1;
        restartedPath = scriptPath;
        return Promise.resolve(0);
      },
    });
    await setAutoUpdate(ctx, true);
    ctx.lines.length = 0;
    ctx.errors.length = 0;

    await expect(startCliUpdateCheck(ctx, ['sync', '--quiet'], 'npm').result).resolves.toEqual({ kind: 'restarted', exitCode: 0 });
    expect(commands).toEqual([
      { command: 'npm', args: ['install', '--global', 'tokenaires@latest'] },
      { command: 'npm', args: ['root', '--global'] },
    ]);
    expect(restarts).toBe(1);
    expect(restartedPath).toBe('/usr/local/lib/node_modules/tokenaires/dist/cli.js');
    expect(ctx.lines).toEqual([]);
    expect(ctx.errors).toEqual([]);
  });

  it('continues quietly when the package manager cannot update', async () => {
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/usr/local/lib/node_modules/tokenaires/dist/cli.js',
      fetch: () => Promise.resolve(Response.json({ version: '0.4.0' })),
      run: () => Promise.resolve({ code: 1, stdout: '', stderr: 'command unavailable' }),
    });
    await setAutoUpdate(ctx, true);
    ctx.lines.length = 0;

    await expect(startCliUpdateCheck(ctx, ['sync', '--quiet'], 'npm').result).resolves.toEqual({ kind: 'none' });
    expect(ctx.lines).toEqual([]);
    expect(ctx.errors).toEqual([]);
  });

  it('does not check temporary runs or scans', async () => {
    let requests = 0;
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/home/user/.npm/_npx/hash/node_modules/tokenaires/dist/cli.js',
      fetch: () => {
        requests += 1;
        return Promise.resolve(Response.json({ version: '0.4.0' }));
      },
    });

    await expect(findCliInstaller(ctx, ['sync'])).resolves.toBeNull();
    await expect(findCliInstaller(ctx, ['scan'])).resolves.toBeNull();
    expect(requests).toBe(0);
  });

  it('does not save update preferences from a temporary runner', async () => {
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/home/user/.npm/_npx/hash/node_modules/tokenaires/dist/cli.js',
    });

    await expect(runCli(ctx, ['updates', 'on'])).resolves.toBe(0);
    expect(ctx.lines.join('\n')).toContain('only available for recognized global installs');
    await expect(access(join(home, 'tokenaires', 'updates.json'))).rejects.toThrow();
  });

  it('finds a global install under a custom npm prefix', async () => {
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/custom/npm-prefix/node_modules/tokenaires/dist/cli.js',
      run: (command) => Promise.resolve({
        code: command === 'npm' ? 0 : 1,
        stdout: command === 'npm' ? '/custom/npm-prefix/node_modules\n' : '',
        stderr: '',
      }),
    });

    await expect(findCliInstaller(ctx, ['sync'])).resolves.toBe('npm');
  });

  it('remembers the installer when its command later becomes unavailable', async () => {
    const scriptPath = '/custom/npm-prefix/node_modules/tokenaires/dist/cli.js';
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath,
      run: (command) => Promise.resolve({
        code: command === 'npm' ? 0 : 1,
        stdout: command === 'npm' ? '/custom/npm-prefix/node_modules\n' : '',
        stderr: '',
      }),
    });
    await expect(findCliInstaller(ctx, ['sync'])).resolves.toBe('npm');

    const withoutNpm = testContext({ home, env: { XDG_CONFIG_HOME: home }, scriptPath, run: () => Promise.resolve({ code: 1, stdout: '', stderr: '' }) });
    await expect(findCliInstaller(withoutNpm, ['sync'])).resolves.toBe('npm');
  });

  it('finds a global pnpm install under a custom global directory', async () => {
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/custom/pnpm-home/global/custom/hash/node_modules/.pnpm/tokenaires@0.3.0/node_modules/tokenaires/dist/cli.js',
      run: (command) => Promise.resolve({
        code: command === 'pnpm' ? 0 : 1,
        stdout: command === 'pnpm' ? '/custom/pnpm-home/global/custom/hash/node_modules\n' : '/other/node_modules\n',
        stderr: '',
      }),
    });

    await expect(findCliInstaller(ctx, ['sync'])).resolves.toBe('pnpm');
  });

  it('remembers the new pnpm path after an automatic update', async () => {
    const root = '/custom/pnpm-home/global/custom/hash/node_modules';
    const oldPath = `${root}/.pnpm/tokenaires@0.3.0/node_modules/tokenaires/dist/cli.js`;
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: oldPath,
      fetch: () => Promise.resolve(Response.json({ version: '0.4.0' })),
      run: (command, args) => Promise.resolve({
        code: command === 'pnpm' ? 0 : 1,
        stdout: command === 'pnpm' && args[0] === 'root' ? `${root}\n` : '',
        stderr: '',
      }),
      restart: () => Promise.resolve(0),
    });
    await expect(findCliInstaller(ctx, ['sync'])).resolves.toBe('pnpm');
    await setAutoUpdate(ctx, true);
    ctx.lines.length = 0;

    await expect(startCliUpdateCheck(ctx, ['sync', '--quiet'], 'pnpm').result).resolves.toEqual({ kind: 'restarted', exitCode: 0 });
    const updatedPath = `${root}/tokenaires/dist/cli.js`;
    const withoutPnpm = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: updatedPath,
      run: () => Promise.resolve({ code: 1, stdout: '', stderr: '' }),
    });
    await expect(findCliInstaller(withoutPnpm, ['sync'])).resolves.toBe('pnpm');
  });

  it('finds a global Bun install under a custom global directory', async () => {
    const ctx = testContext({
      home,
      env: { XDG_CONFIG_HOME: home },
      scriptPath: '/custom/bun-root/node_modules/tokenaires/dist/cli.js',
      run: (command) => Promise.resolve({
        code: command === 'bun' ? 0 : 1,
        stdout: command === 'bun' ? '/custom/bun-root node_modules (1 installed)\n└── tokenaires@0.3.0\n' : '',
        stderr: '',
      }),
    });

    await expect(findCliInstaller(ctx, ['sync'])).resolves.toBe('bun');
  });
});
