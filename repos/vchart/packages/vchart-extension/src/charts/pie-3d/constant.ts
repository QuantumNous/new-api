import { baseSeriesMark } from '@visactor/vchart/esm/series/base/constant';
import { MarkTypeEnum } from '@visactor/vchart/esm/mark/interface/type';
import { SeriesMarkNameEnum } from '@visactor/vchart/esm/series/interface/type';
import { MarkType3dEnum, SeriesMark3dNameEnum } from '../3d/enum';

export const pie3dSeriesMark = {
  ...baseSeriesMark,
  [SeriesMark3dNameEnum.pie3d]: { name: SeriesMark3dNameEnum.pie3d, type: MarkType3dEnum.arc3d },
  [SeriesMarkNameEnum.labelLine]: { name: SeriesMarkNameEnum.labelLine, type: MarkTypeEnum.path }
};
