import type {
  IFixedTooltipPositionPattern,
  IGlobalTooltipPositionPattern,
  TooltipFixedPosition
} from '../../../../typings/tooltip/position';
import { isFunction, isNumber, isObject, isValid } from '@visactor/vutils';

export const getActualTooltipPositionValue = (
  position: number | ((event: MouseEvent) => number) | null | undefined,
  event: MouseEvent
): number => {
  let result: number;
  if (isValid(position)) {
    if (isNumber(position)) {
      result = position as number;
    } else if (isFunction(position)) {
      //  这里额外判断下是否合法
      const tooltipPosition = (position as (event: MouseEvent) => number)(event);

      if (isNumber(tooltipPosition)) {
        result = tooltipPosition;
      }
    }
  }
  return result;
};

// 'left' | 'innerLeft' |  'centerLeft' | 'center'  | 'centerRight' | 'innerRight'  |  'right'
// 'top' | 'innerTop' | 'centerTop' | 'center' | 'centerBottom' | 'innerBottom' | 'bottom'
export type TooltipPositionType = -2 | -1.5 | -1 | 0 | 1 | 1.5 | 2;

/** position 对齐方式在 x、y 分量下的分解 */
export const positionType: Record<TooltipFixedPosition, [TooltipPositionType, TooltipPositionType]> = {
  left: [-2, 0],
  right: [2, 0],
  top: [0, -2],
  bottom: [0, 2],

  insideTop: [0, -1.5],
  insideBottom: [0, 1.5],
  insideLeft: [-1.5, 0],
  insideRight: [1.5, 0],

  insideTopLeft: [-1.5, -1.5],
  insideTopRight: [1.5, -1.5],
  insideBottomLeft: [-1.5, 1.5],
  insideBottomRight: [1.5, 1.5],

  lt: [-2, -2],
  tl: [-2, -2],
  rt: [2, -2],
  tr: [2, -2],
  bl: [-2, 2],
  lb: [-2, 2],
  br: [2, 2],
  rb: [2, 2],
  inside: [0, 0], // 旧版兼容
  center: [0, 0],
  centerBottom: [0, 1],
  centerTop: [0, -1],
  centerLeft: [-1, 0],
  centerRight: [1, 0]
};

export const getPositionType = (
  position: TooltipFixedPosition,
  dim: 'x' | 'y',
  defaultCase: TooltipPositionType = 2
): TooltipPositionType => positionType[position]?.[dim === 'x' ? 0 : 1] ?? defaultCase;

export const isGlobalTooltipPositionPattern = (obj: any): obj is IGlobalTooltipPositionPattern => {
  return (
    isObject(obj) &&
    (isValid((obj as IGlobalTooltipPositionPattern).left) ||
      isValid((obj as IGlobalTooltipPositionPattern).right) ||
      isValid((obj as IGlobalTooltipPositionPattern).top) ||
      isValid((obj as IGlobalTooltipPositionPattern).bottom))
  );
};

export const isFixedTooltipPositionPattern = (obj: any): obj is IFixedTooltipPositionPattern => {
  return (
    isObject(obj) &&
    (isValid((obj as IFixedTooltipPositionPattern).x) || isValid((obj as IFixedTooltipPositionPattern).y))
  );
};
