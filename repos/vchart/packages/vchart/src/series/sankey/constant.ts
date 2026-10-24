import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const sankeySeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.node]: { name: SeriesMarkNameEnum.node, type: MarkTypeEnum.rect },
  [SeriesMarkNameEnum.link]: { name: SeriesMarkNameEnum.link, type: MarkTypeEnum.linkPath }
};
