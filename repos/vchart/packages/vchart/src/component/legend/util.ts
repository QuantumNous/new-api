import type { ITitle } from './interface';
import { isEmpty } from '@visactor/vutils';
import { mergeSpec } from '@visactor/vutils-extension';
import { transformToGraphic } from '../../util/style';

export function transformLegendTitleAttributes(title: ITitle) {
  const transformedTitle = {
    ...title
  };
  if (!isEmpty(title.style)) {
    transformedTitle.textStyle = transformToGraphic(title.style);
  }
  if (!isEmpty(title.textStyle)) {
    mergeSpec(transformedTitle.textStyle, transformToGraphic(title.textStyle));
  }

  if (title.shape?.style) {
    transformToGraphic(transformedTitle.shape.style);
  }

  if (title.background?.style) {
    transformToGraphic(transformedTitle.background.style);
  }
  return transformedTitle;
}
