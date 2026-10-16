import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const correlationSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.nodePoint]: { name: SeriesMarkNameEnum.nodePoint, type: MarkTypeEnum.symbol },
  [SeriesMarkNameEnum.ripplePoint]: { name: SeriesMarkNameEnum.ripplePoint, type: MarkTypeEnum.ripple },
  [SeriesMarkNameEnum.centerPoint]: { name: SeriesMarkNameEnum.centerPoint, type: MarkTypeEnum.symbol },
  [SeriesMarkNameEnum.centerLabel]: { name: SeriesMarkNameEnum.centerLabel, type: MarkTypeEnum.text }
};
