import { shareOfLeader } from "@/lib/share";
import { cn } from "@/lib/utils";

export function ShareBar({ tokens, leader, className }: { tokens: number; leader: number; className?: string }) {
  const widthPercent = shareOfLeader(tokens, leader) * 100;
  return (
    <span aria-hidden="true" className={cn("block h-1 overflow-hidden rounded-full bg-foreground/[0.07]", className)}>
      <span
        className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ width: `${widthPercent}%` }}
      />
    </span>
  );
}
