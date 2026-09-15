import type { IGlobalScale } from './interface';
import type { IBaseScale } from '@visactor/vscale';
import type { IChart } from '../chart/interface';
import type { IChartSpec } from '../typings/spec';
import type { IVisualScale, IVisualSpecScale } from '../typings';
import type { StatisticOperations } from '../data/transforms/interface';
export declare class GlobalScale implements IGlobalScale {
    private _scaleSpecMap;
    private _scaleMap;
    private _modelScaleSpecMap;
    private _markAttributeScaleMap;
    private _spec;
    private readonly _chart;
    constructor(spec: IChartSpec['scales'], chart: IChart);
    private _createFromSpec;
    private _setAttrFromSpec;
    updateSpec(spec: IChartSpec['scales']): {
        change: boolean;
        reMake: boolean;
        reRender: boolean;
        reSize: boolean;
        reCompile: boolean;
    };
    registerModelScale(spec: IVisualSpecScale<unknown, unknown>): void;
    removeModelScale(filter: (spec: IVisualSpecScale<unknown, unknown>) => boolean): void;
    getScale(user_id: string): IBaseScale | null;
    getScaleSpec(user_id: string): IVisualSpecScale<unknown, unknown> | null;
    getStatisticalFields: (dataId: string) => {
        key: string;
        operations: StatisticOperations;
    }[];
    private _getSeriesByRawDataId;
    private _getSeriesBySeriesId;
    updateScaleDomain(defaultDomain: unknown[]): void;
    private _updateMarkScale;
    registerMarkAttributeScale(spec: IVisualScale, seriesId: number): IBaseScale;
}
