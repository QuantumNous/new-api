import type { ISunburstAnimationParams } from './interface';
import type { Datum } from '../../../typings';
import { computeRatio, getInnerMostElements } from './utils';
import { maxInArray, minInArray } from '@visactor/vutils';
import type { IAnimationTypeConfig } from '../../../animation/interface';
import type { IMarkGraphic } from '../../../mark/interface/common';

const computeInnerAngleRange = (mark: IMarkGraphic[]): [number, number] => {
  const minStartAngle = minInArray(mark.map(m => m.getFinalAttribute().startAngle * 1));
  const maxEndAngle = maxInArray(mark.map(m => m.getFinalAttribute().endAngle * 1));
  return [minStartAngle, maxEndAngle];
};

export const sunburstExit = (params: ISunburstAnimationParams): IAnimationTypeConfig => {
  return {
    channel: {
      startAngle: {
        from: (_d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().startAngle,
        to: (_d: Datum, graphic: IMarkGraphic) => {
          const { startAngle, endAngle } = params.animationInfo();
          // 得到最内层的elements.
          const innerElements = getInnerMostElements(graphic.parent.children);
          // 计算range
          const range = computeInnerAngleRange(innerElements);
          // 计算比例
          const ratio = computeRatio(graphic.getFinalAttribute().startAngle, range);
          return ratio * (endAngle - startAngle) + startAngle;
        }
      },
      endAngle: {
        from: (_d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().endAngle,
        to: (_d: Datum, graphic: IMarkGraphic) => {
          const { startAngle, endAngle } = params.animationInfo();
          // 得到最内层的elements.
          const innerElements = getInnerMostElements(graphic.parent.children);
          // 计算range
          const range = computeInnerAngleRange(innerElements);
          // 计算比例
          const ratio = computeRatio(graphic.getFinalAttribute().endAngle, range);
          return ratio * (endAngle - startAngle) + startAngle;
        }
      },
      outerRadius: {
        from: (_d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().outerRadius,
        to: () => params.animationInfo().innerRadius
      },
      innerRadius: {
        from: (_d: Datum, graphic: IMarkGraphic) => graphic.getFinalAttribute().innerRadius,
        to: () => params.animationInfo().innerRadius
      }
    }
  };
};
