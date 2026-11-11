"use client";

import type { BoardEntry } from "@tokenaires/contracts";
import { UserPlusRoundedIcon } from "@solar-icons/react/linear";
import { motion } from "motion/react";
import Link from "next/link";
import { AgentStack, AgentStackCompact, agentList } from "@/components/brand/agent-stack";
import { TierBadge } from "@/components/brand/tier-badge";
import { GlowSurface } from "@/components/motion/glow-surface";
import { RollingNumber } from "@/components/motion/rolling-number";
import { Avatar } from "@/components/ui/avatar";
import { formatFull } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LADDER } from "./ladder";
import { ShareBar } from "./share-bar";

function RankChip({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular",
        rank === 1
          ? "bg-accent text-accent-ink"
          : "bg-foreground/[0.08] text-t2",
      )}
    >
      #{rank}
    </span>
  );
}

function cardLabel(entry: BoardEntry, name: string) {
  const base = `${name}, rank ${entry.rank}, ${formatFull(entry.tokens)} tokens`;
  return entry.sources.length > 0 ? `${base}, uses ${agentList(entry.sources)}` : base;
}

const COMPACT = { notation: "compact", maximumFractionDigits: 1 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;

function Step({
  rank,
  height,
  delay,
}: {
  rank: number;
  height: string;
  delay: number;
}) {
  const first = rank === 1;
  return (
    <motion.div
      aria-hidden="true"
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ duration: 0.55, delay: 0.1 + delay, ease: EASE }}
      style={{ transformOrigin: "bottom" }}
      className={cn(
        "relative overflow-hidden rounded-b-[14px] border-x border-b sm:rounded-b-[var(--radius-card)]",
        height,
        first
          ? "border-accent/40 bg-[linear-gradient(180deg,hsl(var(--glow)/0.22),hsl(var(--glow)/0.04))]"
          : "border-line bg-[linear-gradient(180deg,hsl(var(--foreground)/0.06),hsl(var(--foreground)/0.015))]",
      )}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-[300] leading-none tracking-[-0.06em] tabular",
          first ? "text-[30px] text-accent-text sm:text-[44px]" : "text-[22px] text-t4 sm:text-[44px]",
          rank === 3 && "text-[16px] sm:text-[28px]",
        )}
      >
        {rank}
      </span>
    </motion.div>
  );
}

function OpenCard({ rank }: { rank: number }) {
  return (
    <div className="flex min-h-[132px] flex-col items-center justify-between rounded-t-[14px] border border-b-0 border-dashed border-line-strong px-2 py-3 text-center sm:min-h-[168px] sm:items-start sm:rounded-t-[var(--radius-card)] sm:p-4 sm:text-left">
      <span className="self-center sm:self-start">
        <RankChip rank={rank} />
      </span>
      <span className="flex flex-col items-center gap-1.5 text-xs text-t3 sm:flex-row sm:gap-2 sm:text-sm">
        <UserPlusRoundedIcon className="size-4" aria-hidden="true" />
        Open seat
      </span>
    </div>
  );
}

function CompactCard({ entry }: { entry: BoardEntry }) {
  const name = entry.user.name ?? entry.user.handle;
  const first = entry.rank === 1;
  return (
    <Link
      href={`/u/${entry.user.handle}`}
      aria-label={cardLabel(entry, name)}
      className={cn(
        "relative flex min-h-[132px] flex-col items-center overflow-hidden rounded-t-[14px] border border-b-0 border-line bg-panel-raised px-2 pb-2.5 pt-3 text-center sm:hidden",
        first && "border-accent/40",
      )}
    >
      {first && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,hsl(var(--glow)/0.16),transparent_70%)]"
        />
      )}
      <span className="relative">
        <RankChip rank={entry.rank} />
      </span>
      <Avatar src={entry.user.avatarUrl} name={name} size={first ? 44 : 36} priority className="relative mt-2.5" />
      <span className="relative mt-2 w-full truncate text-xs font-medium">{name}</span>
      <span
        className={cn("relative mt-0.5 text-[15px] font-medium leading-none tracking-[-0.03em] tabular", first && "text-accent-text")}
        title={`${formatFull(entry.tokens)} tokens`}
      >
        <RollingNumber value={entry.tokens} format={COMPACT} />
      </span>
      <AgentStackCompact sources={entry.sources} className="relative mt-2" />
    </Link>
  );
}

function Card({ entry, leader }: { entry: BoardEntry; leader: number }) {
  const name = entry.user.name ?? entry.user.handle;
  const first = entry.rank === 1;
  return (
    <GlowSurface className="hidden rounded-t-[var(--radius-card)] transition-transform duration-200 hover:-translate-y-0.5 sm:block">
      <Link
        href={`/u/${entry.user.handle}`}
        aria-label={cardLabel(entry, name)}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-t-[var(--radius-card)] border border-line bg-panel-raised p-4 transition-[border-color] duration-200 hover:border-line-strong",
          first && "border-accent/40 hover:border-accent/70",
        )}
      >
        {first && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,hsl(var(--glow)/0.16),transparent_70%)]"
          />
        )}
        <span className="relative flex items-center justify-between">
          <RankChip rank={entry.rank} />
          <TierBadge tier={entry.tier} />
        </span>
        <span className="relative mt-4 flex items-center gap-3">
          <Avatar
            src={entry.user.avatarUrl}
            name={name}
            size={first ? 48 : 40}
            priority
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-t3">
              @{entry.user.handle}
            </span>
          </span>
        </span>
        <span className="relative mt-5 flex items-end justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span
              className={cn(
                "font-[450] leading-none tracking-[-0.04em] tabular",
                first ? "text-[32px]" : "text-[26px]",
              )}
              title={`${formatFull(entry.tokens)} tokens`}
            >
              <RollingNumber value={entry.tokens} format={COMPACT} />
            </span>
            <span className="text-xs text-t3">tokens</span>
          </span>
          <AgentStack sources={entry.sources} />
        </span>
        <ShareBar
          tokens={entry.tokens}
          leader={leader}
          className="relative mt-3"
        />
      </Link>
    </GlowSurface>
  );
}

export function TopThree({
  entries,
  leader,
}: {
  entries: BoardEntry[];
  leader: number;
}) {
  return (
    <ol
      aria-label="Top three"
      className="grid grid-cols-3 items-end gap-2 sm:gap-3"
    >
      {LADDER.map(({ rank, step, order, delay }) => {
        const entry = entries.find((candidate) => candidate.rank === rank);
        return (
          <motion.li
            key={entry?.user.handle ?? `open-${rank}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay, ease: EASE }}
            className={cn("flex min-w-0 flex-col", order)}
          >
            {entry ? (
              <>
                <CompactCard entry={entry} />
                <Card entry={entry} leader={leader} />
              </>
            ) : (
              <OpenCard rank={rank} />
            )}
            <Step rank={rank} height={step} delay={delay} />
          </motion.li>
        );
      })}
    </ol>
  );
}
