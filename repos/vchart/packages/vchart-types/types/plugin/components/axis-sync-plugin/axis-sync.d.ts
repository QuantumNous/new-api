import type { IComponentPlugin, IComponentPluginService } from '../interface';
import type { CartesianAxis, ILinearAxisSync } from '../../../component/axis/cartesian';
import { BasePlugin } from '../../base/base-plugin';
export declare class AxisSyncPlugin extends BasePlugin<IComponentPluginService> implements IComponentPlugin<IComponentPluginService> {
    static readonly pluginType: 'component';
    static readonly type: string;
    readonly type: string;
    constructor();
    protected _checkEnableSync(axis: CartesianAxis): ILinearAxisSync | false;
    private _getTargetAxis;
    onInit(service: IComponentPluginService, axis: CartesianAxis): void;
    onDidCompile(service: IComponentPluginService, axis: CartesianAxis): void;
}
