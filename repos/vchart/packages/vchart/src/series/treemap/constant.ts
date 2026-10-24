import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const treemapSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.nonLeaf]: { name: SeriesMarkNameEnum.nonLeaf, type: MarkTypeEnum.rect },
  [SeriesMarkNameEnum.leaf]: { name: SeriesMarkNameEnum.leaf, type: MarkTypeEnum.rect },
  [SeriesMarkNameEnum.nonLeafLabel]: { name: SeriesMarkNameEnum.nonLeafLabel, type: MarkTypeEnum.text }
};
