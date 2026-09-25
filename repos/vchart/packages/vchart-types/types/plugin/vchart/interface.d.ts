import type { IVChart } from '../../core/interface';
import type { IBasePlugin, IBasePluginService, MaybePromise } from '../base/interface';
export interface IVChartPlugin<T extends IVChartPluginService = any> extends IBasePlugin<T> {
    specKey?: string;
    onInit?: (service: T) => MaybePromise<void>;
}
export interface IVChartPluginConstructor {
    readonly pluginType: 'vchart';
    readonly specKey?: string;
    readonly type: string;
    new (): IVChartPlugin;
}
export interface IVChartPluginService<T extends IVChartPlugin = any> extends IBasePluginService<T> {
    globalInstance: IVChart;
    onInit?: () => MaybePromise<void>;
}
