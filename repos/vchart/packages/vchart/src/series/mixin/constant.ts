import { MarkTypeEnum } from '../../mark/interface/type';
import type { SeriesMarkMap } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { SeriesMarkNameEnum } from '../interface/type';

export const lineLikeSeriesMark: SeriesMarkMap = {
  [SeriesMarkNameEnum.point]: { name: SeriesMarkNameEnum.point, type: MarkTypeEnum.symbol },
  [SeriesMarkNameEnum.line]: { name: SeriesMarkNameEnum.line, type: MarkTypeEnum.line }
};
