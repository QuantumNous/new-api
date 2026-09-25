import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const sunburstSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.sunburst]: { name: SeriesMarkNameEnum.sunburst, type: MarkTypeEnum.arc }
};
