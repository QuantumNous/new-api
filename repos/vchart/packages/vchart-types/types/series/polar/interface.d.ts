import type { ISeriesSpec } from '../../typings/spec/common';
export interface IPolarSeriesSpec extends ISeriesSpec {
    centerX?: number | string;
    centerY?: number | string;
    outerRadius?: number;
    innerRadius?: number;
    startAngle?: number;
    endAngle?: number;
    categoryField?: string | string[];
    valueField?: string | string[];
    radiusField?: string | string[];
    angleField?: string | string[];
    radius?: number;
    sortDataByAxis?: boolean;
}
export interface IPolarSeriesTheme {
    radius?: number;
    outerRadius?: number;
    innerRadius?: number;
    startAngle?: number;
    endAngle?: number;
}
