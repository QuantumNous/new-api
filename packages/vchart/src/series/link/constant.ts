import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const linkSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.group]: { name: SeriesMarkNameEnum.group, type: MarkTypeEnum.group },
  [SeriesMarkNameEnum.link]: { name: SeriesMarkNameEnum.link, type: MarkTypeEnum.rule },
  [SeriesMarkNameEnum.arrow]: { name: SeriesMarkNameEnum.arrow, type: MarkTypeEnum.symbol }
};
