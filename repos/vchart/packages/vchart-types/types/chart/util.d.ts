import type { IChartSpec } from '../typings';
import type { ICartesianChartSpec } from './cartesian/interface';
import type { IChartOption } from './interface/common';
import type { IUpdateSpecEffects, IUpdateSpecResult } from '../model/interface';
export declare function setDefaultCrosshairForCartesianChart(spec: ICartesianChartSpec): void;
export declare function calculateChartSize(spec: {
    width?: number;
    height?: number;
}, option: Pick<IChartOption, 'canvas' | 'container' | 'mode' | 'modeParams'>, defaultSize: {
    width: number;
    height: number;
}): {
    width: number;
    height: number;
};
export declare function normalizeUpdateSpecEffects(result: IUpdateSpecResult): IUpdateSpecEffects;
export declare function isUpdateSpecResultLocalOnly(result: IUpdateSpecResult): boolean;
export declare function isUpdateSpecResultComponentOnly(result: IUpdateSpecResult): boolean;
export declare function mergeUpdateResult(target: IUpdateSpecResult, ...sources: IUpdateSpecResult[]): IUpdateSpecResult;
export declare function getTrimPaddingConfig(chartType: string, spec: IChartSpec): {
    paddingInner: number;
    paddingOuter: number;
} | {
    paddingOuter: number;
    paddingInner?: undefined;
};
