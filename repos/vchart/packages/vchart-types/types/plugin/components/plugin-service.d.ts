import type { IComponentPlugin, IComponentPluginService } from './interface';
import type { IComponent } from '../../component/interface';
import { BasePluginService } from '../base/base-plugin-service';
export declare class ComponentPluginService<T extends IComponentPlugin = IComponentPlugin> extends BasePluginService<T> implements IComponentPluginService<T> {
    component: IComponent;
    constructor(component: IComponent);
    releaseAll(): void;
}
