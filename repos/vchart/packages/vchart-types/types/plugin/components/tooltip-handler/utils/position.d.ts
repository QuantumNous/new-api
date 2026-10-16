import type { IFixedTooltipPositionPattern, IGlobalTooltipPositionPattern, TooltipFixedPosition } from '../../../../typings/tooltip/position';
export declare const getActualTooltipPositionValue: (position: number | ((event: MouseEvent) => number), event: MouseEvent) => number;
export type TooltipPositionType = -2 | -1.5 | -1 | 0 | 1 | 1.5 | 2;
export declare const positionType: Record<TooltipFixedPosition, [TooltipPositionType, TooltipPositionType]>;
export declare const getPositionType: (position: TooltipFixedPosition, dim: 'x' | 'y', defaultCase?: TooltipPositionType) => TooltipPositionType;
export declare const isGlobalTooltipPositionPattern: (obj: any) => obj is IGlobalTooltipPositionPattern;
export declare const isFixedTooltipPositionPattern: (obj: any) => obj is IFixedTooltipPositionPattern;
