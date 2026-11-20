import type { Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isArray, isValid } from '@visactor/vutils';
import type { DimensionTooltipInfo, MarkTooltipInfo, TooltipInfo } from './interface';

export const isMarkInfo = (info: Maybe<TooltipInfo>): info is MarkTooltipInfo => isValid(info) && !isArray(info);

export const isDimensionInfo = (info: Maybe<TooltipInfo>): info is DimensionTooltipInfo =>
  isValid(info) && isArray(info);
