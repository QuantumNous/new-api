import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const pieSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.pie]: { name: SeriesMarkNameEnum.pie, type: MarkTypeEnum.arc },
  [SeriesMarkNameEnum.labelLine]: { name: SeriesMarkNameEnum.labelLine, type: MarkTypeEnum.path }
};
