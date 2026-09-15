export type TooltipPositionCallback<T> = (event: MouseEvent) => T;
export type TooltipPositionValue = number | TooltipPositionCallback<number>;
export interface ITooltipPositionFixedValue {
    orient: TooltipFixedPosition;
    mode: TooltipPositionMode;
    offset?: number;
}
export type TooltipPositionPatternItem = TooltipPositionValue | ITooltipPositionFixedValue;
export type TooltipFixedPosition = 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'lt' | 'tr' | 'rt' | 'bl' | 'lb' | 'br' | 'rb' | 'center' | 'centerTop' | 'centerBottom' | 'centerLeft' | 'centerRight' | 'inside' | 'insideTop' | 'insideBottom' | 'insideLeft' | 'insideRight' | 'insideTopLeft' | 'insideTopRight' | 'insideBottomLeft' | 'insideBottomRight';
export type TooltipPositionMode = 'pointer' | 'mark' | 'crosshair';
export interface IGlobalTooltipPositionPattern {
    left?: TooltipPositionValue;
    right?: TooltipPositionValue;
    top?: TooltipPositionValue;
    bottom?: TooltipPositionValue;
}
export interface IFixedTooltipPositionPattern {
    x: TooltipPositionPatternItem;
    y: TooltipPositionPatternItem;
}
export type TooltipPosition = IGlobalTooltipPositionPattern | IFixedTooltipPositionPattern | TooltipFixedPosition;
export interface ITooltipPositionActual {
    x: number;
    y: number;
}
export type TooltipPositionKeys = 'top' | 'left' | 'right' | 'bottom';
