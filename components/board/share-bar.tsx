"use client";

import { motion } from "motion/react";
import { shareOfLeader } from "@/lib/share";
import { cn } from "@/lib/utils";

export function ShareBar({ tokens, leader, className }: { tokens: number; leader: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("block h-1 overflow-hidden rounded-full bg-foreground/[0.07]", className)}>
      <motion.span
        className="block h-full rounded-full bg-accent"
        initial={{ width: 0 }}
        animate={{ width: `${shareOfLeader(tokens, leader) * 100}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </span>
  );
}
