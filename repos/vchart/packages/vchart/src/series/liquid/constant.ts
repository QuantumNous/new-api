import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const LiquidSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.liquidGroup]: { name: SeriesMarkNameEnum.liquidGroup, type: MarkTypeEnum.group },
  [SeriesMarkNameEnum.liquid]: { name: SeriesMarkNameEnum.liquid, type: MarkTypeEnum.liquid },
  [SeriesMarkNameEnum.liquidBackground]: { name: SeriesMarkNameEnum.liquidBackground, type: MarkTypeEnum.group },
  [SeriesMarkNameEnum.liquidOutline]: { name: SeriesMarkNameEnum.liquidOutline, type: MarkTypeEnum.group }
};
