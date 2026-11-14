import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const funnelSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.funnel]: { name: SeriesMarkNameEnum.funnel, type: MarkTypeEnum.polygon },
  [SeriesMarkNameEnum.transform]: { name: SeriesMarkNameEnum.transform, type: MarkTypeEnum.polygon },
  [SeriesMarkNameEnum.transformLabel]: { name: SeriesMarkNameEnum.transformLabel, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.outerLabel]: { name: SeriesMarkNameEnum.outerLabel, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.outerLabelLine]: { name: SeriesMarkNameEnum.outerLabelLine, type: MarkTypeEnum.rule }
};
