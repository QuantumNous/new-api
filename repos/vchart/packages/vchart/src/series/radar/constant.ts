import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';
import { lineLikeSeriesMark } from '../mixin/constant';

export const radarSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  ...lineLikeSeriesMark,
  [SeriesMarkNameEnum.area]: { name: SeriesMarkNameEnum.area, type: MarkTypeEnum.area }
};
