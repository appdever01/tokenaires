import { join } from 'node:path';
import { SCHEDULE, SCHEDULE_ENV_PASSTHROUGH, readEnv } from '@/config';

export interface ScheduleTarget {
  nodePath: string;
  scriptPath: string;
  home: string;
  env: NodeJS.ProcessEnv;
  hours: number;
}

const HOUR_PATTERN = /^(\d+)\s*(h|hr|hrs|hour|hours)?$|^(1)\s*(d|day)$/i;
const SECONDS_PER_HOUR = 3600;
const HOURS_PER_DAY = 24;

export function parseHours(value: string): number | null {
  const match = HOUR_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = match[3] ? HOURS_PER_DAY : Number(match[1]);
  return Number.isInteger(hours) && hours >= SCHEDULE.minHours && hours <= SCHEDULE.maxHours ? hours : null;
}

export function intervalLabel(hours: number): string {
  return hours === HOURS_PER_DAY ? 'day' : `${hours} hours`;
}

export function cronExpression(hours: number): string {
  return hours >= HOURS_PER_DAY ? '0 0 * * *' : `0 */${hours} * * *`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stringTag(value: string): string {
  return `<string>${escapeXml(value)}</string>`;
}

export function plistPath(home: string): string {
  return join(home, 'Library', 'LaunchAgents', `${SCHEDULE.label}.plist`);
}

export function logPath(home: string): string {
  return join(home, 'Library', 'Logs', SCHEDULE.logFileName);
}

export function syncArguments(target: ScheduleTarget): string[] {
  return [target.nodePath, target.scriptPath, 'sync', '--quiet'];
}

function environmentBlock(env: NodeJS.ProcessEnv): string[] {
  const entries = SCHEDULE_ENV_PASSTHROUGH.flatMap((key) => {
    const value = readEnv(env, key);
    return value ? [`      <key>${key}</key>`, `      ${stringTag(value)}`] : [];
  });
  return entries.length > 0 ? ['    <key>EnvironmentVariables</key>', '    <dict>', ...entries, '    </dict>'] : [];
}

export function renderPlist(target: ScheduleTarget): string {
  const args = syncArguments(target).map((arg) => `      ${stringTag(arg)}`);
  const log = stringTag(logPath(target.home));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '  <dict>',
    '    <key>Label</key>',
    `    ${stringTag(SCHEDULE.label)}`,
    '    <key>ProgramArguments</key>',
    '    <array>',
    ...args,
    '    </array>',
    '    <key>StartInterval</key>',
    `    <integer>${target.hours * SECONDS_PER_HOUR}</integer>`,
    '    <key>RunAtLoad</key>',
    '    <false/>',
    '    <key>StandardOutPath</key>',
    `    ${log}`,
    '    <key>StandardErrorPath</key>',
    `    ${log}`,
    ...environmentBlock(target.env),
    '  </dict>',
    '</plist>',
    '',
  ].join('\n');
}

function shellQuote(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

export function cronLine(target: ScheduleTarget): string {
  return `${cronExpression(target.hours)} ${syncArguments(target).map(shellQuote).join(' ')}`;
}
