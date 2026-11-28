import { MarkTypeEnum, SeriesMarkNameEnum } from '@visactor/vchart';
import { MarkType3dEnum, SeriesMark3dNameEnum } from '../3d/enum';

export const bar3dSeriesMark = {
  [SeriesMarkNameEnum.label]: { name: SeriesMarkNameEnum.label, type: MarkTypeEnum.text },
  [SeriesMark3dNameEnum.bar3d]: { name: SeriesMark3dNameEnum.bar3d, type: MarkType3dEnum.rect3d }
};
