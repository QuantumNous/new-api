import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const dotSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.group]: { name: SeriesMarkNameEnum.group, type: MarkTypeEnum.group },
  [SeriesMarkNameEnum.grid]: { name: SeriesMarkNameEnum.grid, type: MarkTypeEnum.rule },
  [SeriesMarkNameEnum.gridBackground]: { name: SeriesMarkNameEnum.gridBackground, type: MarkTypeEnum.rect },
  [SeriesMarkNameEnum.dot]: { name: SeriesMarkNameEnum.dot, type: MarkTypeEnum.symbol },
  [SeriesMarkNameEnum.title]: { name: SeriesMarkNameEnum.title, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.subTitle]: { name: SeriesMarkNameEnum.subTitle, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.symbol]: { name: SeriesMarkNameEnum.symbol, type: MarkTypeEnum.symbol }
};
