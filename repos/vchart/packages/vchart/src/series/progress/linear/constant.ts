import { MarkTypeEnum } from '../../../mark/interface/type';
import { baseSeriesMark } from '../../base/constant';
import type { SeriesMarkMap } from '../../interface/common';
import { SeriesMarkNameEnum } from '../../interface/type';

export const linearProgressSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.track]: { name: SeriesMarkNameEnum.track, type: MarkTypeEnum.rect },
  [SeriesMarkNameEnum.progress]: { name: SeriesMarkNameEnum.progress, type: MarkTypeEnum.rect },
  [SeriesMarkNameEnum.group]: { name: SeriesMarkNameEnum.group, type: MarkTypeEnum.group }
};
