import {
  AGENT_SOURCES,
  BOARD_PERIODS,
  type BoardPeriod,
  type BoardSource,
} from '@tokenaires/contracts';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const BOARD_SOURCES = ['all', ...AGENT_SOURCES] as const;
export const MAX_BOARD_PAGE = 1000;

export class BoardQueryDto {
  @IsOptional()
  @IsIn(BOARD_PERIODS)
  period: BoardPeriod = 'all';

  @IsOptional()
  @IsIn(BOARD_SOURCES)
  source: BoardSource = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BOARD_PAGE)
  page = 1;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
