import { Command, InvalidArgumentError } from 'commander';
import { CLI_NAME, CLI_VERSION, SCHEDULE } from '@/config';
import type { Context } from '@/context';
import { describeError } from '@/api/errors';
import { login } from '@/commands/login';
import { logout } from '@/commands/logout';
import { scan } from '@/commands/scan';
import { schedule, type ScheduleMode } from '@/commands/schedule';
import { parseHours } from '@/schedule/launchd';
import { status } from '@/commands/status';
import { sync } from '@/commands/sync';
import { configPath, loadConfig } from '@/store';
import { autoUpdateEnabled, findCliInstaller, setAutoUpdate, startCliUpdateCheck } from '@/updates';
import { renderHeader } from '@/ui/header';
import { symbols, theme } from '@/ui/theme';

function parseMode(value: string): ScheduleMode {
  if (value === 'on' || value === 'off') return value;
  throw new InvalidArgumentError('Use on or off.');
}

function parseEvery(value: string): number {
  const hours = parseHours(value);
  if (hours === null) {
    throw new InvalidArgumentError(`Use whole hours from ${SCHEDULE.minHours} to ${SCHEDULE.maxHours}, for example 2h, 12h or 1d.`);
  }
  return hours;
}

function header(ctx: Context): void {
  for (const line of renderHeader()) ctx.out.line(line);
}

async function loginThenSync(ctx: Context): Promise<void> {
  const existing = await loadConfig(configPath(ctx.env, ctx.home));
  const config = existing ?? (await login(ctx));
  await sync(ctx, { quiet: false, justLoggedIn: existing === null }, config);
}

export function buildProgram(ctx: Context): Command {
  const program = new Command(CLI_NAME)
    .description('Put your AI coding token usage on the Tokenaires board.')
    .version(CLI_VERSION, '-v, --version')
    .option('--dry-run', 'same as scan: read local logs and upload nothing')
    .configureOutput({
      writeOut: (text) => {
        ctx.out.line(text.trimEnd());
      },
      writeErr: (text) => {
        ctx.out.error(text.trimEnd());
      },
    })
    .action(async (options: { dryRun?: boolean }) => {
      header(ctx);
      await (options.dryRun ? scan(ctx) : loginThenSync(ctx));
    });
  program.command('login').description('connect this device to your Tokenaires account').action(async () => {
    header(ctx);
    await login(ctx);
  });
  program
    .command('scan')
    .alias('dry-run')
    .description('read local logs and print totals without uploading anything')
    .action(async () => {
      header(ctx);
      await scan(ctx);
    });
  program
    .command('sync')
    .description('upload new usage records and show your rank')
    .option('-q, --quiet', 'print nothing unless something goes wrong')
    .action(async (options: { quiet?: boolean }) => {
      const quiet = options.quiet === true;
      if (!quiet) header(ctx);
      await sync(ctx, { quiet });
    });
  program
    .command('status')
    .description('show login state, rank and tier progress')
    .action(async () => {
      header(ctx);
      await status(ctx);
    });
  program.command('logout').description('remove the saved login and device key').action(() => logout(ctx));
  program
    .command('updates')
    .description('enable or disable automatic CLI updates before syncing')
    .argument('<mode>', 'on or off')
    .action(async (mode: string) => {
      if (mode !== 'on' && mode !== 'off') throw new InvalidArgumentError('Use on or off.');
      const installer = await findCliInstaller(ctx, ['sync']);
      if (!installer) {
        ctx.out.line('  Automatic updates are only available for recognized global installs.');
        return;
      }
      await setAutoUpdate(ctx, mode === 'on');
    });
  program
    .command('schedule')
    .description(`sync automatically, every ${SCHEDULE.defaultHours} hours by default`)
    .argument('<mode>', 'on or off', parseMode)
    .option('-e, --every <hours>', `hours between syncs, ${SCHEDULE.minHours} to ${SCHEDULE.maxHours} (default ${SCHEDULE.defaultHours})`, parseEvery)
    .action((mode: ScheduleMode, options: { every?: number }) => schedule(ctx, mode, options.every === undefined ? {} : { hours: options.every }));
  return program;
}

export async function runCli(ctx: Context, argv: string[]): Promise<number> {
  let backgroundUpdate: ReturnType<typeof startCliUpdateCheck> | null = null;
  try {
    const installer = await findCliInstaller(ctx, argv);
    if (installer && await autoUpdateEnabled(ctx)) {
      const update = startCliUpdateCheck(ctx, argv, installer);
      const result = await update.result;
      if (result.kind === 'restarted') return result.exitCode;
      if (result.kind === 'notice') ctx.out.error(`  ${result.text}`);
    } else if (installer) {
      backgroundUpdate = startCliUpdateCheck(ctx, argv, installer);
    }
    await buildProgram(ctx).parseAsync(argv, { from: 'user' });
    if (backgroundUpdate) {
      const result = await Promise.race([
        backgroundUpdate.result,
        new Promise<{ kind: 'none' }>((resolve) => {
          setTimeout(() => {
            resolve({ kind: 'none' });
          }, 50);
        }),
      ]);
      backgroundUpdate.cancel();
      if (result.kind === 'notice') ctx.out.line(`  ${result.text}`);
      if (result.kind === 'restarted') return result.exitCode;
    }
    return 0;
  } catch (error) {
    backgroundUpdate?.cancel();
    ctx.out.error(`  ${theme.bad(`${symbols.cross} Error`)} ${describeError(error)}`);
    return 1;
  }
}
