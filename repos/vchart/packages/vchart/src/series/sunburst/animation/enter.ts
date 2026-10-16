import type { ISunburstAnimationParams } from './interface';
import type { Datum } from '../../../typings';
import { computeRatio, getInnerMostElements } from './utils';
import { isEmpty, maxInArray, minInArray } from '@visactor/vutils';
import type { IAnimationTypeConfig } from '../../../animation/interface';
import type { IMarkGraphic } from '../../../mark/interface';

const computeInnerAngleRange = (graphics: IMarkGraphic[], startAngle: number, endAngle: number): [number, number] => {
  // 处理enter时从无到有的case, 例如图例.
  if (isEmpty(graphics)) {
    return [startAngle, endAngle];
  }

  const minStartAngle = minInArray(graphics.map(m => m.getFinalAttribute().startAngle * 1));
  const maxEndAngle = maxInArray(graphics.map(m => m.getFinalAttribute().endAngle * 1));
  return [minStartAngle, maxEndAngle];
};

export const sunburstEnter = (params: ISunburstAnimationParams): IAnimationTypeConfig => {
  return {
    channel: {
      startAngle: {
        from: (d: Datum, graphic: IMarkGraphic) => {
          const { startAngle, endAngle } = params.animationInfo();
          // 得到最内层的elements.
          const innerElements = getInnerMostElements(graphic.parent.children);
          // 计算间距
          const angleRange = computeInnerAngleRange(innerElements, startAngle, endAngle);
          // 计算比例
          const ratio = computeRatio(graphic.getFinalAttribute().startAngle, angleRange);
          return ratio * (endAngle - startAngle) + startAngle;
        },
        to: (d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().startAngle
      },
      endAngle: {
        from: (d: Datum, graphic: IMarkGraphic) => {
          const { startAngle, endAngle } = params.animationInfo();
          // 得到最内层的elements.
          const innerElements = getInnerMostElements(graphic.parent.children);
          // 计算间距
          const angleRange = computeInnerAngleRange(innerElements, startAngle, endAngle);
          // 计算比例
          const ratio = computeRatio(graphic.getFinalAttribute().endAngle, angleRange);
          return ratio * (endAngle - startAngle) + startAngle;
        },
        to: (d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().endAngle
      },
      outerRadius: {
        from: (d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().innerRadius,
        to: (d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().outerRadius
      },
      innerRadius: {
        from: (d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().innerRadius,
        to: (d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().innerRadius
      }
    }
  };
};
