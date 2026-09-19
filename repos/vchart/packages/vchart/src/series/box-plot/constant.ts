import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const boxPlotSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.boxPlot]: { name: SeriesMarkNameEnum.boxPlot, type: MarkTypeEnum.boxPlot },
  [SeriesMarkNameEnum.outlier]: { name: SeriesMarkNameEnum.outlier, type: MarkTypeEnum.symbol }
};
