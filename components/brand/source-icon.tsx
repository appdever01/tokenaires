import type { AgentSource } from "@tokenaires/contracts";
import { AGENT_SOURCE_LABELS } from "@tokenaires/contracts";
import type { IconBaseProps, IconType } from "react-icons";
import { RiOpenaiFill } from "react-icons/ri";
import { SiClaude, SiCline, SiGithubcopilot, SiGoogle, SiGooglegemini, SiMoonshotai, SiOpencode, SiQwen, SiZedindustries } from "react-icons/si";
import { cn } from "@/lib/utils";

function lettermark(letter: string): IconType {
  function Lettermark({ className, ...props }: IconBaseProps) {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
        <rect x="0.5" y="0.5" width="15" height="15" rx="4" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <text x="8" y="11.6" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {letter}
        </text>
      </svg>
    );
  }
  return Lettermark;
}

function DevinIcon({ className, ...props }: IconBaseProps) {
  return (
    <svg viewBox="48 70 309 308" fill="currentColor" className={className} {...props}>
      <path d="M70 159.333V91.3471C70 88.3592 71.594 85.5983 74.1816 84.1044L133.043 50.1205C135.631 48.6265 138.819 48.6265 141.407 50.1205L200.269 84.1044C202.856 85.5983 204.45 88.3592 204.45 91.3471V126.068C204.708 137.606 210.806 148.734 221.531 154.926C232.256 161.117 244.942 160.834 255.063 155.289L285.132 137.929C287.719 136.435 290.907 136.435 293.495 137.929L352.357 171.913C354.944 173.406 356.538 176.167 356.538 179.155V247.123C356.538 250.111 354.944 252.872 352.357 254.366L293.495 288.35C290.907 289.844 287.719 289.844 285.132 288.35L255.306 271.13C245.146 265.456 232.344 265.117 221.534 271.358C210.809 277.55 204.711 288.678 204.453 300.215V334.926C204.453 337.914 202.859 340.675 200.271 342.169L141.41 376.153C138.822 377.647 135.634 377.647 133.046 376.153L74.1845 342.169C71.5969 340.675 70.0028 337.914 70.0028 334.926V266.959C70.0029 263.971 71.5969 261.21 74.1845 259.716L133.046 225.732C135.634 224.238 138.822 224.238 141.41 225.732L171.547 243.132C181.656 248.638 194.306 248.906 205.005 242.729C215.815 236.488 221.922 225.231 222.088 213.595C221.83 202.057 215.732 189.737 205.008 183.545C194.283 177.353 181.597 177.636 171.476 183.181L141.269 200.72C138.67 202.229 135.461 202.228 132.864 200.716L74.1576 166.562C71.5835 165.065 70 162.311 70 159.333Z" />
    </svg>
  );
}

const ICONS: Record<AgentSource, IconType> = {
  "claude-code": SiClaude,
  codex: RiOpenaiFill,
  "gemini-cli": SiGooglegemini,
  antigravity: SiGoogle,
  opencode: SiOpencode,
  "kimi-code": SiMoonshotai,
  "qwen-code": SiQwen,
  "copilot-cli": SiGithubcopilot,
  cline: SiCline,
  "roo-code": lettermark("R"),
  "kilo-code": lettermark("K"),
  zcode: lettermark("Z"),
  zed: SiZedindustries,
  devin: DevinIcon,
};

const TINTS: Record<AgentSource, string> = {
  "claude-code": "text-claude",
  codex: "text-t2",
  "gemini-cli": "text-gemini",
  antigravity: "text-gemini",
  opencode: "text-t2",
  "kimi-code": "text-t2",
  "qwen-code": "text-qwen",
  "copilot-cli": "text-t2",
  cline: "text-t2",
  "roo-code": "text-t2",
  "kilo-code": "text-t2",
  zcode: "text-t2",
  zed: "text-t2",
  devin: "text-t2",
};

export function SourceIcon({ source, className }: { source: AgentSource; className?: string }) {
  const Icon = ICONS[source];
  return <Icon className={cn("size-3.5 shrink-0", TINTS[source], className)} aria-label={AGENT_SOURCE_LABELS[source]} role="img" />;
}
