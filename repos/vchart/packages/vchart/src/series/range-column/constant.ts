import { MarkTypeEnum } from '../../mark/interface/type';
import { barSeriesMark } from '../bar/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const rangeColumnSeriesMark: SeriesMarkMap = {
  ...barSeriesMark,
  [SeriesMarkNameEnum.minLabel]: { name: SeriesMarkNameEnum.minLabel, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.maxLabel]: { name: SeriesMarkNameEnum.maxLabel, type: MarkTypeEnum.text }
};
