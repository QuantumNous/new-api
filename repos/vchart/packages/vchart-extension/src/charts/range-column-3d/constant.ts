import { MarkTypeEnum, SeriesMarkNameEnum } from '@visactor/vchart';
import { bar3dSeriesMark } from '../bar-3d/constant';

export const rangeColumn3dSeriesMark = {
  ...bar3dSeriesMark,
  [SeriesMarkNameEnum.minLabel]: { name: SeriesMarkNameEnum.minLabel, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.maxLabel]: { name: SeriesMarkNameEnum.maxLabel, type: MarkTypeEnum.text }
};
