import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const roseSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.rose]: { name: SeriesMarkNameEnum.rose, type: MarkTypeEnum.arc }
};
