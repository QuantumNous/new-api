import type { IChartPlugin, IChartPluginService } from '../interface';
import { BasePlugin } from '../../base/base-plugin';
import { registerChartPlugin } from '../register';
import type { IPoint } from '../../../typings';
import { getDefaultTriggerEventByMode } from '../../../component/common/trigger/config';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export class ChartResizeZoomPlugin extends BasePlugin<IChartPluginService> implements IChartPlugin {
  static readonly pluginType: 'chart';
  static readonly specKey = 'resizeZoom';
  static readonly type: string = 'ChartResizeZoomPlugin';
  readonly type: string = 'ChartResizeZoomPlugin';

  protected _container?: HTMLElement;
  protected _triggerEvent?: string;
  protected _minZoom?: number;
  protected _maxZoom?: number;
  protected _zoom: number = 1;
  protected _rate?: number;

  constructor() {
    super(ChartResizeZoomPlugin.type);
  }

  onAfterInitChart(service: IChartPluginService, chartSpec: any) {
    const chart = service.globalInstance;
    const spec = chart.getSpec()?.[ChartResizeZoomPlugin.specKey] ?? { enabled: false };
    if (spec.enabled !== true) {
      return;
    }
    this._minZoom = spec.min ?? MIN_ZOOM;
    this._maxZoom = spec.max ?? MAX_ZOOM;
    this._rate = spec.rate ?? 0.1;
    this._container = chart.getContainer();
    this._triggerEvent = getDefaultTriggerEventByMode(service.globalInstance.getChart().getOption().mode).zoom;
    if (this._container && this._triggerEvent) {
      this._container.addEventListener(this._triggerEvent as keyof HTMLElementEventMap, this._onWheel as EventListener);
    }
  }

  protected _onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    const zoom = Math.pow(1.005, -e.deltaY * Math.pow(16, e.deltaMode) * 0.2 * this._rate);
    const center = { x: e.offsetX, y: e.offsetY };
    this.zoom(zoom, center);
  };

  /**
   * 缩放图表
   * @param zoom 缩放比例
   * @param pointerPos 缩放中心，即鼠标位置
   */
  zoom(zoom: number, pointerPos?: IPoint) {
    const vchart = this.service.globalInstance;
    if (!vchart) {
      return;
    }
    const oldZoom = this._zoom;
    let tempZoom = this._zoom * zoom;
    if ((tempZoom <= this._minZoom && zoom < 1) || (tempZoom >= this._maxZoom && zoom > 1)) {
      if (tempZoom <= this._minZoom && this._zoom > this._minZoom) {
        tempZoom = this._minZoom;
      } else if (tempZoom >= this._maxZoom && this._zoom < this._maxZoom) {
        tempZoom = this._maxZoom;
      } else {
        return;
      }
    }

    if (tempZoom === oldZoom) {
      return;
    }

    const actualZoomRatio = tempZoom / oldZoom;
    this._zoom = tempZoom;

    vchart.resize(vchart.getCurrentSize().width * this._zoom, vchart.getCurrentSize().height * this._zoom);
    // 滚动容器滚动， 保持当前鼠标位置在缩放后不变
    if (pointerPos && this._container) {
      const { scrollLeft, scrollTop } = this._container;
      this._container.scrollLeft = scrollLeft + pointerPos.x * (actualZoomRatio - 1);
      this._container.scrollTop = scrollTop + pointerPos.y * (actualZoomRatio - 1);
    }
  }

  release(): void {
    if (this._container && this._triggerEvent) {
      this._container.removeEventListener(
        this._triggerEvent as keyof HTMLElementEventMap,
        this._onWheel as EventListener
      );
    }
  }
}

export const registerChartResizeZoomPlugin = () => {
  registerChartPlugin(ChartResizeZoomPlugin);
};
