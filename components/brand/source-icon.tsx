import type { AgentSource } from "@tokenaires/contracts";
import { AGENT_SOURCE_LABELS } from "@tokenaires/contracts";
import type { IconBaseProps, IconType } from "react-icons";
import { RiOpenaiFill } from "react-icons/ri";
import { SiClaude, SiCline, SiGithubcopilot, SiGoogle, SiGooglegemini, SiMoonshotai, SiOpencode, SiQwen, SiZedindustries } from "react-icons/si";
import { cn } from "@/lib/utils";

function VscodeIcon({ className, ...props }: IconBaseProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} {...props}>
      <path
        d="M96.4614 10.7962L75.8569 0.875542C73.4719 -0.272773 70.6217 0.211611 68.75 2.08333L1.29858 63.5832C-0.515693 65.2373 -0.513607 68.0937 1.30308 69.7452L6.81272 74.754C8.29793 76.1042 10.5347 76.2036 12.1338 74.9905L93.3609 13.3699C96.086 11.3026 100 13.2462 100 16.6667V16.4275C100 14.0265 98.6246 11.8378 96.4614 10.7962Z"
        fill="#0065A9"
      />
      <path
        d="M96.4614 89.2038L75.8569 99.1245C73.4719 100.273 70.6217 99.7884 68.75 97.9167L1.29858 36.4169C-0.515693 34.7627 -0.513607 31.9063 1.30308 30.2548L6.81272 25.246C8.29793 23.8958 10.5347 23.7964 12.1338 25.0095L93.3609 86.6301C96.086 88.6974 100 86.7538 100 83.3334V83.5726C100 85.9735 98.6246 88.1622 96.4614 89.2038Z"
        fill="#007ACC"
      />
      <path
        d="M75.8578 99.1263C73.4721 100.274 70.6219 99.7885 68.75 97.9166C71.0564 100.223 75 98.5895 75 95.3278V4.67213C75 1.41039 71.0564 -0.223106 68.75 2.08329C70.6219 0.211402 73.4721 -0.273666 75.8578 0.873633L96.4587 10.7807C98.6234 11.8217 100 14.0112 100 16.4132V83.5871C100 85.9891 98.6234 88.1786 96.4586 89.2196L75.8578 99.1263Z"
        fill="#1F9CF0"
      />
    </svg>
  );
}

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
  vscode: VscodeIcon,
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
  vscode: "text-t2",
};

export function SourceIcon({ source, className }: { source: AgentSource; className?: string }) {
  const Icon = ICONS[source];
  return <Icon className={cn("size-3.5 shrink-0", TINTS[source], className)} aria-label={AGENT_SOURCE_LABELS[source]} role="img" />;
}
