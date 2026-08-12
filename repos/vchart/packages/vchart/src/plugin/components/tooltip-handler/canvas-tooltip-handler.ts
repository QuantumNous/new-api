import type { ILayer, INode, IStage } from '@visactor/vrender-core';
import { BaseTooltipHandler } from './base';
import { Tooltip as TooltipComponent } from '@visactor/vrender-components/tooltip';
import { isValid, isNil } from '@visactor/vutils';
import type { TooltipHandlerParams } from '../../../component/tooltip';
import type { IComponentPluginService } from '../interface';
import { registerComponentPlugin } from '../register';
import { TooltipHandlerType } from '../../../component/tooltip/constant';
import type { ITooltipActual } from '../../../typings';
import type { IContainerSize } from '@visactor/vrender-components/tooltip/type';
import { getTooltipAttributes } from './utils/attribute';
import type { ITooltipAttributes } from './interface';

/**
 * The tooltip handler class.
 */
export class CanvasTooltipHandler extends BaseTooltipHandler {
  static readonly type = TooltipHandlerType.canvas;
  readonly type = TooltipHandlerType.canvas;

  private _layer: ILayer;
  protected _el?: HTMLCanvasElement;
  protected _tooltipCanvasId?: string;
  protected _tooltipComponent: TooltipComponent;
  protected _attributes?: ITooltipAttributes | null = null;

  constructor() {
    super(CanvasTooltipHandler.type);
  }

  onAdd(service: IComponentPluginService<any>): void {
    super.onAdd(service);
    this._tooltipCanvasId = (this._chartOption.modeParams as any)?.tooltipCanvasId;
  }

  private _initTooltipComponent(stage: IStage) {
    const layer = this._getLayer(stage);
    this._tooltipComponent = new TooltipComponent({
      autoCalculatePosition: false,
      autoMeasure: false
    });
    layer.add(this._tooltipComponent as unknown as INode);
  }

  private _getLayer(stage: IStage) {
    if (this._layer) {
      return this._layer;
    }

    this._layer = stage.createLayer(this._tooltipCanvasId);

    // 需要关闭 layer 对应的 canvas 的事件
    const layerCanvas = this._layer.layerHandler.canvas.nativeCanvas as HTMLCanvasElement;
    // TODO：待 vrender 支持
    if (layerCanvas && layerCanvas.style) {
      layerCanvas.style.touchAction = 'none';
      layerCanvas.style.pointerEvents = 'none';
    }

    return this._layer;
  }

  // 计算 tooltip 内容区域的宽高，并缓存结果
  protected _getTooltipBoxSize(actualTooltip: ITooltipActual, changePositionOnly: boolean): IContainerSize | undefined {
    if (!changePositionOnly || isNil(this._attributes)) {
      const globalFontFamily = this._chartOption?.getTheme('fontFamily');
      this._attributes = getTooltipAttributes(actualTooltip, this._component.getSpec(), globalFontFamily);
    }
    const { panel } = this._attributes ?? {};
    // canvas模式下, size需要考虑border size, 目的是为了精准判断边界是否超出画布，达到confine效果
    // html模式不提供confine, 所以不考虑精准计算size

    return {
      width: panel.width + panel.lineWidth,
      height: panel.height + panel.lineWidth
    };
  }

  protected _removeTooltip() {
    if (this._layer) {
      this._layer.removeAllChild();
      // this._layer.render();
    }
    this._attributes = null;
  }

  protected _updateTooltip(visible: boolean, params: TooltipHandlerParams) {
    this._visible = visible;

    const stage = this._compiler.getStage();
    if (!stage) {
      return;
    }

    if (!visible) {
      if (this._tooltipComponent && this._tooltipComponent.attribute.visible) {
        this._tooltipComponent.hideAll();
        this._tooltipComponent.setAttributes({
          visibleAll: false
        });
      }
      return;
    }

    if (!this._tooltipComponent) {
      this._initTooltipComponent(stage);
    }

    const { activeTooltipSpec } = params;
    const pos = activeTooltipSpec.position;
    if (!params.changePositionOnly) {
      this._tooltipComponent.setAttributes({
        ...this._attributes,
        ...pos
      });
    } else if (isValid(pos)) {
      this._tooltipComponent.setAttributes(pos);
    }

    if (!this._tooltipComponent.attribute.visible) {
      this._tooltipComponent.showAll();
      this._tooltipComponent.setAttributes({
        visibleAll: true
      });
    }
  }

  isTooltipShown() {
    return this._tooltipComponent?.attribute.visibleAll;
  }

  release() {
    super.release();
    this._layer?.release();
  }
}

export const registerCanvasTooltipHandler = () => {
  registerComponentPlugin(CanvasTooltipHandler);
};
