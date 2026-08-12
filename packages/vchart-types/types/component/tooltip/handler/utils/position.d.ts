import { TooltipFixedPosition } from '../../../../typings/tooltip/position';
export declare const getActualTooltipPositionValue: (position: number | ((event: MouseEvent) => number), event: MouseEvent) => number;
export type TooltipHorizontalPositionType = 'left' | 'right' | 'middle';
export type TooltipVerticalPositionType = 'top' | 'bottom' | 'middle';
export declare const positionType: Record<TooltipFixedPosition, [TooltipHorizontalPositionType, TooltipVerticalPositionType]>;
export declare const getHorizontalPositionType: (position: TooltipFixedPosition, defaultCase?: TooltipHorizontalPositionType) => TooltipHorizontalPositionType;
export declare const getVerticalPositionType: (position: TooltipFixedPosition, defaultCase?: TooltipVerticalPositionType) => TooltipVerticalPositionType;
