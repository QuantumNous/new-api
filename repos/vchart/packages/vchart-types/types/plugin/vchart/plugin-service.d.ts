import type { IVChartPlugin, IVChartPluginService } from './interface';
import type { IVChart } from '../../core';
import { BasePluginService } from '../base/base-plugin-service';
export declare class VChartPluginService<T extends IVChartPlugin = IVChartPlugin> extends BasePluginService<T> implements IVChartPluginService<T> {
    globalInstance: IVChart;
    constructor(globalInstance: IVChart);
    onInit(): void;
    releaseAll(): void;
}
