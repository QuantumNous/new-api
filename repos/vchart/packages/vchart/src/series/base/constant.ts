import { MarkTypeEnum } from '../../mark/interface/type';
import { SeriesMarkNameEnum } from '../interface/type';
import type { SeriesMarkMap } from '../interface/common';
import { PREFIX } from '../../constant/base';

export const baseSeriesMark: SeriesMarkMap = {
  [SeriesMarkNameEnum.label]: { name: SeriesMarkNameEnum.label, type: MarkTypeEnum.text }
};

export const RECT_X = `${PREFIX}_rect_x`;
export const RECT_X1 = `${PREFIX}_rect_x1`;
export const RECT_Y = `${PREFIX}_rect_y`;
export const RECT_Y1 = `${PREFIX}_rect_y1`;

export const defaultSeriesIgnoreCheckKeys: { [key: string]: true } = {
  data: true
};

export const defaultSeriesCompileCheckKeys: { [key: string]: true } = {
  xField: true,
  yField: true,
  invalidType: true,
  animation: true,
  animationAppear: true,
  animationEnter: true,
  animationUpdate: true,
  animationExit: true,
  animationNormal: true
};

export const defaultSeriesCompileOnlyCheckKeys: { [key: string]: true } = {
  animationAppear: true,
  animationEnter: true,
  animationUpdate: true,
  animationExit: true,
  animationNormal: true
};
