import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Context } from '@/context';
import { UsageError } from '@/api/errors';
import { SCHEDULE } from '@/config';
import {
  cronLine,
  intervalLabel,
  isEphemeralPath,
  plistPath,
  renderPlist,
  type ScheduleTarget,
  windowsCreateArguments,
  windowsDeleteArguments,
} from '@/schedule/launchd';
import { theme } from '@/ui/theme';

export type ScheduleMode = 'on' | 'off';

export interface ScheduleOptions {
  hours?: number;
}

function target(ctx: Context, hours: number): ScheduleTarget {
  return { nodePath: ctx.nodePath, scriptPath: ctx.scriptPath, home: ctx.home, env: ctx.env, hours };
}

async function macOn(ctx: Context, hours: number): Promise<void> {
  const path = plistPath(ctx.home);
  await mkdir(dirname(path), { recursive: true });
  await ctx.run('launchctl', ['unload', path]);
  await writeFile(path, renderPlist(target(ctx, hours)), { mode: 0o644 });
  const loaded = await ctx.run('launchctl', ['load', '-w', path]);
  if (loaded.code !== 0) throw new UsageError(`launchctl could not load the schedule: ${loaded.stderr.trim() || 'unknown error'}`);
  ctx.out.line(`  ${theme.good('Scheduled.')} Tokenaires will sync every ${intervalLabel(hours)}.`);
  ctx.out.line(theme.dim(`  ${path}`));
}

async function macOff(ctx: Context): Promise<void> {
  const path = plistPath(ctx.home);
  await ctx.run('launchctl', ['unload', '-w', path]);
  const existed = await rm(path).then(
    () => true,
    () => false,
  );
  ctx.out.line(existed ? `  ${theme.good('Schedule removed.')}` : '  No schedule was set up.');
}

async function windowsOn(ctx: Context, hours: number): Promise<void> {
  const args = windowsCreateArguments(target(ctx, hours));
  const created = await ctx.run('schtasks', args);
  if (created.code !== 0) {
    throw new UsageError(`schtasks could not create the scheduled task: ${created.stderr.trim() || 'unknown error'}`);
  }
  ctx.out.line(`  ${theme.good('Scheduled.')} Tokenaires will sync every ${intervalLabel(hours)}.`);
  ctx.out.line(theme.dim(`  Task name: ${SCHEDULE.label}`));
}

async function windowsOff(ctx: Context): Promise<void> {
  const deleted = await ctx.run('schtasks', windowsDeleteArguments());
  if (deleted.code === 0) {
    ctx.out.line(`  ${theme.good('Schedule removed.')}`);
    return;
  }
  const errorText = `${deleted.stderr} ${deleted.stdout}`.toLowerCase();
  if (errorText.includes('cannot find') || errorText.includes('does not exist')) {
    ctx.out.line('  No schedule was set up.');
    return;
  }
  throw new UsageError(`schtasks could not remove the scheduled task: ${deleted.stderr.trim() || 'unknown error'}`);
}

function linux(ctx: Context, mode: ScheduleMode, hours: number): void {
  const line = cronLine(target(ctx, hours));
  if (mode === 'on') {
    ctx.out.line(`  Add this line to your crontab (run crontab -e) to sync every ${intervalLabel(hours)}:`);
  } else {
    ctx.out.line('  Remove this line from your crontab (run crontab -e):');
  }
  ctx.out.line();
  ctx.out.line(`  ${theme.accent(line)}`);
}

export async function schedule(ctx: Context, mode: ScheduleMode, options: ScheduleOptions = {}): Promise<void> {
  const hours = options.hours ?? SCHEDULE.defaultHours;
  if (!ctx.scriptPath) throw new UsageError('Could not work out where the tokenaires script lives.');
  if (mode === 'on' && isEphemeralPath(ctx.scriptPath)) {
    throw new UsageError(
      'Cannot schedule automated sync from a temporary runner (npx, bunx, or pnpm dlx). Install tokenaires globally first.',
    );
  }
  ctx.out.line();
  if (ctx.platform === 'darwin') await (mode === 'on' ? macOn(ctx, hours) : macOff(ctx));
  else if (ctx.platform === 'win32') await (mode === 'on' ? windowsOn(ctx, hours) : windowsOff(ctx));
  else if (ctx.platform === 'linux') linux(ctx, mode, hours);
  else throw new UsageError('Scheduling is supported on macOS, Windows and Linux. Run tokenaires sync from your own scheduler.');
  ctx.out.line();
}

