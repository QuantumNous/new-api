import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const heatmapSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.cell]: { name: SeriesMarkNameEnum.cell, type: MarkTypeEnum.cell },
  [SeriesMarkNameEnum.cellBackground]: { name: SeriesMarkNameEnum.cellBackground, type: MarkTypeEnum.cell }
};
