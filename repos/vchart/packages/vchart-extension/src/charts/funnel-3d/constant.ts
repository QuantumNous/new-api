import { baseSeriesMark, MarkTypeEnum, SeriesMarkNameEnum } from '@visactor/vchart';
import { MarkType3dEnum, SeriesMark3dNameEnum } from '../3d/enum';

export const funnel3dSeriesMark = {
  ...baseSeriesMark,
  [SeriesMark3dNameEnum.funnel3d]: { name: SeriesMark3dNameEnum.funnel3d, type: MarkType3dEnum.pyramid3d },
  [SeriesMark3dNameEnum.transform3d]: { name: SeriesMark3dNameEnum.transform3d, type: MarkType3dEnum.pyramid3d },
  [SeriesMarkNameEnum.transformLabel]: { name: SeriesMarkNameEnum.transformLabel, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.outerLabel]: { name: SeriesMarkNameEnum.outerLabel, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.outerLabelLine]: { name: SeriesMarkNameEnum.outerLabelLine, type: MarkTypeEnum.rule }
};
