import { MarkTypeEnum } from '../../mark/interface/type';
import { barSeriesMark } from '../bar/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const waterfallSeriesMark: SeriesMarkMap = {
  ...barSeriesMark,
  [SeriesMarkNameEnum.leaderLine]: { name: SeriesMarkNameEnum.leaderLine, type: MarkTypeEnum.rule },
  [SeriesMarkNameEnum.stackLabel]: { name: SeriesMarkNameEnum.stackLabel, type: MarkTypeEnum.text }
};
