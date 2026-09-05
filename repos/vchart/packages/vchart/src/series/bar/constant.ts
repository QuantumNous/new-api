import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const barSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.bar]: { name: SeriesMarkNameEnum.bar, type: MarkTypeEnum.rect },
  [SeriesMarkNameEnum.barBackground]: { name: SeriesMarkNameEnum.barBackground, type: MarkTypeEnum.rect }
};
