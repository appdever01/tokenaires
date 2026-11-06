"use client";

import { AGENT_SOURCES, BOARD_PERIODS, type BoardPeriod, type BoardSource } from "@tokenaires/contracts";
import { SourceIcon } from "@/components/brand/source-icon";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Select, type SelectOption } from "@/components/ui/select";
import { PERIOD_LABELS, PERIOD_SHORT_LABELS, SOURCE_FILTER_LABELS } from "@/lib/constants";
import { BoardSearch } from "./board-search";
import { BoardSummary } from "./board-summary";

const PERIOD_OPTIONS = BOARD_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value], shortLabel: PERIOD_SHORT_LABELS[value] }));

const SOURCE_OPTIONS: ReadonlyArray<SelectOption<BoardSource>> = [
  { value: "all", label: SOURCE_FILTER_LABELS.all },
  ...AGENT_SOURCES.map((source) => ({
    value: source,
    label: SOURCE_FILTER_LABELS[source],
    icon: <SourceIcon source={source} />,
  })),
];

interface BoardControlsProps {
  period: BoardPeriod;
  source: BoardSource;
  searchValue: string;
  onPeriodChange: (period: BoardPeriod) => void;
  onSourceChange: (source: BoardSource) => void;
  onSearchChange: (search: string) => void;
}

export function BoardControls({
  period,
  source,
  searchValue,
  onPeriodChange,
  onSourceChange,
  onSearchChange,
}: BoardControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.02em]">Rich list</h2>
          <BoardSummary />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SegmentedTabs
            aria-label="Period"
            value={period}
            onValueChange={onPeriodChange}
            options={PERIOD_OPTIONS}
            className="shrink-0"
          />
          <Select
            aria-label="Tool"
            value={source}
            onValueChange={onSourceChange}
            options={SOURCE_OPTIONS}
            className="h-9 min-w-0 flex-1 px-3 text-xs sm:h-10 sm:w-[9.5rem] sm:flex-none sm:px-3.5 sm:text-[13px]"
          />
        </div>
      </div>
      <div className="w-full">
        <BoardSearch
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search by name or @handle..."
        />
      </div>
    </div>
  );
}
