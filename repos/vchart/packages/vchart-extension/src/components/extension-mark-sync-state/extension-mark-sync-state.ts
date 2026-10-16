/**
 * @description ExtensionMark SyncState 插件
 *
 * 将配置了 syncState: true 的 extensionMark 的 graphics 与主 mark 的 graphics
 * 通过 context.key 配对，在 afterRender 回调中将主 mark 的当前状态同步到
 * extensionMark graphic。
 */
import {
  type IChartPlugin,
  type IChartPluginService,
  type ISeries,
  type IMark,
  type IMarkGraphic,
  type IEvent,
  type ISeriesSpec,
  BasePlugin,
  ChartEvent,
  registerChartPlugin,
  isValid
} from '@visactor/vchart';
import type { IExtensionMarkSpecWithSyncState } from './type';

const EXTENSION_MARK_SYNC_STATE_PLUGIN_TYPE = 'ExtensionMarkSyncStatePlugin';

export class ExtensionMarkSyncStatePlugin extends BasePlugin<IChartPluginService> implements IChartPlugin {
  static readonly pluginType: 'chart' = 'chart';
  static readonly type: string = EXTENSION_MARK_SYNC_STATE_PLUGIN_TYPE;
  readonly type: string = EXTENSION_MARK_SYNC_STATE_PLUGIN_TYPE;

  /** 取消 afterRender 订阅的函数，release 时调用 */
  private _unsubscribeAfterRender?: () => void;
  /** 已订阅的 event 实例，chart reMake 后会更换 */
  private _subscribedEvent?: IEvent;

  constructor() {
    super(EXTENSION_MARK_SYNC_STATE_PLUGIN_TYPE);
  }

  onAfterInitChart(service: IChartPluginService, chartSpec: any) {
    if (!this._detectSyncState(chartSpec)) {
      return;
    }

    const chart = service.globalInstance.getChart();
    if (!chart) {
      return;
    }

    const event = chart.getEvent();

    if (this._subscribedEvent === event) {
      return;
    }

    this._unsubscribeAfterRender?.();

    const handler = () => this._syncStates();
    event.on(ChartEvent.afterRender, handler);
    this._subscribedEvent = event;
    this._unsubscribeAfterRender = () => {
      event.off(ChartEvent.afterRender, handler);
      this._subscribedEvent = undefined;
    };
  }

  release(): void {
    this._unsubscribeAfterRender?.();
    super.release();
  }

  /** 检测 chartSpec 中是否存在配置了 syncState 的 extensionMark */
  private _detectSyncState(chartSpec: any): boolean {
    const seriesSpecs = chartSpec?.series;
    if (
      seriesSpecs?.some((s: ISeriesSpec) =>
        this._hasExtensionMarkWithSyncState(s.extensionMark as IExtensionMarkSpecWithSyncState[])
      )
    ) {
      return true;
    }
    return this._hasExtensionMarkWithSyncState(chartSpec?.extensionMark);
  }

  private _hasExtensionMarkWithSyncState(extensionMarks: IExtensionMarkSpecWithSyncState[] | undefined): boolean {
    return !!extensionMarks?.some(m => m.type !== 'group' && m.syncState);
  }

  /** 将所有 series 中主 mark 的当前状态同步到对应的 extensionMark graphics */
  private _syncStates() {
    const chart = this.service?.globalInstance.getChart();
    if (!chart) {
      return;
    }

    chart.getAllSeries().forEach(series => {
      const syncSpecs = (series.getSpec()?.extensionMark as IExtensionMarkSpecWithSyncState[] | undefined)?.filter(
        m => m.type !== 'group' && m.syncState
      );
      if (syncSpecs?.length) {
        this._syncSeriesStates(series, syncSpecs);
      }
    });
  }

  /** 将单个 series 主 mark 的当前状态同步到其 extensionMark graphics */
  private _syncSeriesStates(series: ISeries, extensionMarkSpecs: IExtensionMarkSpecWithSyncState[]) {
    const mainGraphicByKey = new Map<string, IMarkGraphic>();
    series.getActiveMarks().forEach((mark: IMark) => {
      mark.getGraphics().forEach(g => {
        const key = g.context?.key;
        if (isValid(key)) {
          mainGraphicByKey.set(String(key), g);
        }
      });
    });

    if (mainGraphicByKey.size === 0) {
      return;
    }

    // 命名格式与 BaseSeries._getExtensionMarkNamePrefix 一致
    const namePrefix = `${series.type}_${series.id}_extensionMark`;

    extensionMarkSpecs.forEach((spec, i) => {
      const markName = isValid(spec.name) ? `${spec.name}` : `${namePrefix}_${i}`;
      const extMark = series.getMarkInName(markName);
      if (!extMark) {
        return;
      }

      extMark.getGraphics().forEach(extGraphic => {
        const key = extGraphic.context?.key;
        if (!isValid(key)) {
          return;
        }

        const mainGraphic = mainGraphicByKey.get(String(key));
        if (!mainGraphic) {
          return;
        }

        const currentStates = mainGraphic.currentStates;
        if (currentStates?.length) {
          extGraphic.useStates(currentStates);
        } else {
          extGraphic.clearStates();
        }
      });
    });
  }
}

/**
 * 注册 ExtensionMark SyncState 插件
 *
 * @example
 * ```ts
 * import { registerExtensionMarkSyncStatePlugin } from '@visactor/vchart-extension';
 *
 * // 在创建 VChart 实例之前注册
 * registerExtensionMarkSyncStatePlugin();
 *
 * // 在 extensionMark 配置中使用 syncState
 * const spec = {
 *   type: 'bar',
 *   extensionMark: [{
 *     type: 'symbol',
 *     dataId: 'barData',
 *     syncState: true,
 *     style: { ... },
 *     state: {
 *       highlight: { ... },
 *       blur: { ... }
 *     }
 *   }]
 * };
 * ```
 */
export const registerExtensionMarkSyncStatePlugin = () => {
  registerChartPlugin(ExtensionMarkSyncStatePlugin);
};
