import { MarkTypeEnum } from '../../../mark/interface/type';
import { baseSeriesMark } from '../../base/constant';
import type { SeriesMarkMap } from '../../interface/common';
import { SeriesMarkNameEnum } from '../../interface/type';

export const progressLikeSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.group]: { name: SeriesMarkNameEnum.group, type: MarkTypeEnum.group }
};
