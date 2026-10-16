import type { IChartPlugin, IChartPluginService } from './interface';
import type { IVChart } from '../../core';
import { BasePluginService } from '../base/base-plugin-service';
import type { VChartRenderActionSource } from '../../core/interface';
import type { IChartSpecInfo } from '../../chart/interface/common';
export declare class ChartPluginService<T extends IChartPlugin = IChartPlugin> extends BasePluginService<T> implements IChartPluginService<T> {
    globalInstance: IVChart;
    constructor(globalInstance: IVChart);
    onInit(chartSpec: any): void;
    onBeforeResize(width: number, height: number): void;
    onAfterChartSpecTransform(chartSpec: any, actionSource: VChartRenderActionSource): void;
    onAfterModelSpecTransform(chartSpec: any, chartSpecInfo: IChartSpecInfo, actionSource: VChartRenderActionSource): void;
    onBeforeInitChart(chartSpec: any, actionSource: VChartRenderActionSource): void;
    onAfterInitChart(chartSpec: any, actionSource: VChartRenderActionSource): void;
    releaseAll(): void;
}
