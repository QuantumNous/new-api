import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';
import { progressLikeSeriesMark } from '../polar/progress-like/constant';

export const gaugeSeriesMark: SeriesMarkMap = {
  ...progressLikeSeriesMark,
  [SeriesMarkNameEnum.segment]: { name: SeriesMarkNameEnum.segment, type: MarkTypeEnum.arc },
  [SeriesMarkNameEnum.track]: { name: SeriesMarkNameEnum.track, type: MarkTypeEnum.arc }
};

export const gaugePointerSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.pin]: { name: SeriesMarkNameEnum.pin, type: MarkTypeEnum.path },
  [SeriesMarkNameEnum.pinBackground]: { name: SeriesMarkNameEnum.pinBackground, type: MarkTypeEnum.path },
  [SeriesMarkNameEnum.pointer]: { name: SeriesMarkNameEnum.pointer, type: [MarkTypeEnum.path, MarkTypeEnum.rect] }
};
