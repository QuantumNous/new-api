import type { IVChartPlugin, IVChartPluginService } from './interface';
import type { IVChart } from '../../core';
import { BasePluginService } from '../base/base-plugin-service';

export class VChartPluginService<T extends IVChartPlugin = IVChartPlugin>
  extends BasePluginService<T>
  implements IVChartPluginService<T>
{
  globalInstance: IVChart;

  constructor(globalInstance: IVChart) {
    super();
    this.globalInstance = globalInstance;
  }

  onInit() {
    this._plugins.forEach(plugin => {
      plugin.onInit && plugin.onInit(this);
    });
  }

  releaseAll(): void {
    super.releaseAll();
    this.globalInstance = null;
  }
}
