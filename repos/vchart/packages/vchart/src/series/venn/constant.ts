import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const vennSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.circle]: { name: SeriesMarkNameEnum.circle, type: MarkTypeEnum.arc },
  [SeriesMarkNameEnum.overlap]: { name: SeriesMarkNameEnum.overlap, type: MarkTypeEnum.path },
  [SeriesMarkNameEnum.overlapLabel]: { name: SeriesMarkNameEnum.overlapLabel, type: MarkTypeEnum.text }
};
