import type {
  IMediaInfo,
  IMediaQueryCheckResult,
  IMediaQuerySpec,
  IMediaQueryOption,
  IMediaQueryItem,
  IMediaQueryActionResult
} from './interface';
import { checkMediaQuery } from './util';
import { executeMediaQueryAction } from './util/action';
import type { IChartPlugin, IChartPluginService } from '../interface';
import { array } from '../../../util';
import type { VChartRenderActionSource } from '../../../core/interface';
import { BasePlugin } from '../../base/base-plugin';
import { registerChartPlugin } from '../register';
import type { IChartSpecInfo } from '../../../chart/interface';
import { cloneDeepSpec } from '@visactor/vutils-extension';

export class MediaQuery extends BasePlugin implements IChartPlugin {
  static readonly pluginType: 'chart' = 'chart';
  static readonly specKey = 'media';
  static readonly type: string = 'MediaQueryPlugin';
  readonly type: string = 'MediaQueryPlugin';

  protected _spec: IMediaQuerySpec;
  protected _option: IMediaQueryOption;

  /** 不带任何媒体查询的图表 spec */
  protected _baseChartSpec: any;
  /** 不带任何媒体查询的图表 spec info */
  protected _baseChartSpecInfo: IChartSpecInfo;

  /** 当前媒体信息 */
  protected _currentMediaInfo: Partial<IMediaInfo> = {};

  /** 当前正在生效的媒体查询 */
  readonly currentActiveItems = new Set<IMediaQueryItem>();

  /** 媒体查询是否已经初始化 */
  protected _initialized: boolean = false;

  constructor() {
    super(MediaQuery.type);
  }

  onInit(service: IChartPluginService, chartSpec: any) {
    if (!chartSpec?.[MediaQuery.specKey]) {
      return;
    }

    const { globalInstance } = service;
    this._option = {
      globalInstance: service.globalInstance,
      updateSpec: (spec: any, compile?: boolean, render?: boolean) => {
        if (render) {
          globalInstance.updateSpecSync(spec);
        } else if (compile) {
          globalInstance.updateSpecAndRecompile(spec, false, {
            transformSpec: true
          });
        } else {
          globalInstance.setRuntimeSpec(spec);
        }
      }
    };
    this._spec = chartSpec[MediaQuery.specKey];
    this._initialized = true;
  }

  onBeforeResize(service: IChartPluginService, width: number, height: number) {
    if (!this._initialized) {
      return;
    }

    this._changeSize(width, height, true, false);
  }

  onAfterChartSpecTransform(service: IChartPluginService, chartSpec: any, actionSource: VChartRenderActionSource) {
    if (!this._initialized) {
      return;
    }

    if (actionSource === 'setCurrentTheme') {
      // 重新执行已生效的所有媒体查询
      this._reInit(false, false);
    }
  }

  onAfterModelSpecTransform(
    service: IChartPluginService,
    chartSpec: any,
    chartInfo: IChartSpecInfo,
    actionSource: VChartRenderActionSource
  ) {
    if (!this._initialized) {
      return;
    }

    if (actionSource === 'updateSpec') {
      this.onBeforeInitChart(service, chartSpec, 'setCurrentTheme');
    }
  }

  onBeforeInitChart(service: IChartPluginService, chartSpec: any, actionSource: VChartRenderActionSource) {
    if (!this._initialized) {
      return;
    }

    let resetMediaQuery: boolean;
    let checkMediaQuery: boolean;

    switch (actionSource) {
      case 'render':
      case 'updateModelSpec':
        resetMediaQuery = false;
        checkMediaQuery = true;
        break;
      case 'setCurrentTheme':
        resetMediaQuery = true;
        checkMediaQuery = false;
        break;
      case 'updateSpecAndRecompile':
        resetMediaQuery = false;
        checkMediaQuery = false;
        break;
    }

    if (resetMediaQuery) {
      this.release();
    }
    if (!this._initialized) {
      // 初始化媒体查询
      this.onInit(service, chartSpec);
    }
    if (resetMediaQuery || checkMediaQuery) {
      // 触发媒体查询
      const { width, height } = this._option.globalInstance.getCurrentSize();
      this._changeSize(width, height, false, false);
    }
  }

  /** 更新图表宽高信息，执行所有相关媒体查询，返回是否命中某个查询 */
  protected _changeSize(width: number, height: number, compile?: boolean, render?: boolean): boolean {
    if (this._currentMediaInfo.width === width && this._currentMediaInfo.height === height) {
      return false;
    }
    this._currentMediaInfo.width = width;
    this._currentMediaInfo.height = height;
    // 由于目前媒体查询只和图表宽高有关，这里执行所有媒体查询
    return this._applyQueries(compile, render);
  }

  /** 执行所有媒体查询，返回是否命中某个查询 */
  protected _applyQueries(compile?: boolean, render?: boolean): boolean {
    // 检查所有查询的查询条件
    const changeToActive: IMediaQueryItem[] = []; // 将会生效的查询
    const changeToInactive: IMediaQueryItem[] = []; // 将会失效的查询
    this._spec.forEach(item => {
      const { hasChanged, isActive } = this._check(item);
      if (hasChanged) {
        if (isActive) {
          changeToActive.push(item);
        } else {
          changeToInactive.push(item);
        }
      }
    });

    if (!changeToActive.length && !changeToInactive.length) {
      return false;
    }
    if (!this._baseChartSpec) {
      this._baseChartSpec = cloneDeepSpec(this._option.globalInstance.getSpec(), ['data', MediaQuery.specKey]);
      this._baseChartSpecInfo = this._option.globalInstance.getSpecInfo();
    }
    let chartSpec: any;
    let chartSpecInfo: any;
    let hasChanged = false;

    // 处理将会失效的查询：重新执行一遍当前生效的查询
    if (changeToInactive.length > 0) {
      chartSpec = cloneDeepSpec(this._baseChartSpec, ['data', MediaQuery.specKey]);
      chartSpecInfo = this._baseChartSpecInfo;
      Array.from(this.currentActiveItems).forEach(item => {
        if (changeToInactive.includes(item)) {
          this.currentActiveItems.delete(item);
          return;
        }
        const result = this._apply(item, chartSpec, chartSpecInfo);
        chartSpec = result.chartSpec;
      });
      hasChanged = true;
    } else {
      chartSpec = this._option.globalInstance.getSpec();
      chartSpecInfo = this._option.globalInstance.getSpecInfo();
    }

    // 处理将会生效的查询
    changeToActive.forEach(item => {
      this.currentActiveItems.add(item);
      const result = this._apply(item, chartSpec, chartSpecInfo);
      chartSpec = result.chartSpec;
      hasChanged ||= result.hasChanged;
    });

    if (hasChanged) {
      this._option.updateSpec(chartSpec, compile, render);
    }
    return true;
  }

  /** 检查媒体查询的条件是否满足 */
  protected _check(item: IMediaQueryItem): IMediaQueryCheckResult {
    const { globalInstance } = this._option;
    const isActive = checkMediaQuery(item.query, this._currentMediaInfo as IMediaInfo, globalInstance);
    return {
      isActive,
      hasChanged: isActive !== this.currentActiveItems.has(item)
    };
  }

  /** 执行一条媒体查询 */
  protected _apply(item: IMediaQueryItem, chartSpec: any, chartSpecInfo: IChartSpecInfo): IMediaQueryActionResult {
    const { query, action } = item;
    let hasChanged = false;
    // 执行
    array(action).forEach(actionItem => {
      const result = executeMediaQueryAction(actionItem, query, chartSpec, chartSpecInfo);
      chartSpec = result.chartSpec;
      hasChanged ||= result.hasChanged;
    });
    return { chartSpec, hasChanged };
  }

  /** 重新初始化，并重新执行一遍当前生效的媒体查询 */
  protected _reInit(compile?: boolean, render?: boolean) {
    let chartSpec = this._option.globalInstance.getSpec();
    this._baseChartSpec = cloneDeepSpec(chartSpec, ['data', MediaQuery.specKey]);
    this._baseChartSpecInfo = this._option.globalInstance.getSpecInfo();

    let hasChanged = false;
    this.currentActiveItems.forEach(item => {
      const result = this._apply(item, chartSpec, this._baseChartSpecInfo);
      chartSpec = result.chartSpec;
      hasChanged ||= result.hasChanged;
    });

    if (hasChanged) {
      this._option.updateSpec(chartSpec, compile, render);
    }
  }

  release() {
    super.release();
    this._initialized = false;
    this._spec = [];
    this._option = undefined;
    this._currentMediaInfo = {};
    this.currentActiveItems.clear();
  }
}

export const registerMediaQuery = () => {
  registerChartPlugin(MediaQuery);
};
