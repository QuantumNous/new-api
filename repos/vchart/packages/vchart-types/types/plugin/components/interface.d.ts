import type { IComponent } from '../../component/interface';
import type { IBasePlugin, IBasePluginService, MaybePromise } from '../base/interface';
interface IContext {
    skipLayout: boolean;
}
export interface IComponentPlugin<T extends IComponentPluginService = any> extends IBasePlugin<T> {
    onWillLayout?: (service: T, ...params: any) => MaybePromise<void>;
    onDidLayout?: (service: T, ...params: any) => MaybePromise<void>;
    onWillLayoutVertical?: (service: T, context: IContext, ...params: any) => MaybePromise<void>;
    onWillLayoutHorizontal?: (service: T, context: IContext, ...params: any) => MaybePromise<void>;
    onDidLayoutVertical?: (service: T, ...params: any) => MaybePromise<void>;
    onDidLayoutHorizontal?: (service: T, ...params: any) => MaybePromise<void>;
}
export interface IComponentPluginConstructor {
    readonly pluginType: 'component';
    readonly specKey?: string;
    readonly type: string;
    new (): IComponentPlugin;
}
export interface IComponentPluginService<T extends IComponentPlugin = any> extends IBasePluginService<T> {
    component: IComponent;
}
export {};
