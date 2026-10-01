import { DEFAULT_CHART_WIDTH, DEFAULT_CHART_HEIGHT } from '../../../constant/base';
// eslint-disable-next-line no-duplicate-imports
import { DEFAULT_OPTIONS } from './constants';
import type { Maybe, IPoint, RenderMode } from '../../../typings';
// eslint-disable-next-line no-duplicate-imports
import type { ITooltipPositionFixedValue, TooltipPositionKeys } from '../../../typings/tooltip/position';
// eslint-disable-next-line no-duplicate-imports
import { isTrueBrowser } from '../../../util/env';
import type {
  TooltipData,
  ITooltipActual,
  TooltipActiveType,
  ITooltipHandler,
  ITooltipPositionActual,
  IGlobalTooltipPositionPattern
} from '../../../typings/tooltip';
// eslint-disable-next-line no-duplicate-imports
import type { TooltipFixedPosition } from '../../../typings/tooltip';
import { getScale } from './utils/common';
import {
  getActualTooltipPositionValue,
  getPositionType,
  isFixedTooltipPositionPattern,
  isGlobalTooltipPositionPattern
} from './utils/position';
import type { IGroup } from '@visactor/vrender-core';
import type { AABBBounds } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isNumber, isObject, isValidNumber, isValid, isFunction } from '@visactor/vutils';
import type { ILayoutModel } from '../../../model/interface';
import type { IContainerSize } from '@visactor/vrender-components';
import type { IChartOption } from '../../../chart/interface';
import type { ITooltipSpec, Tooltip, TooltipHandlerParams } from '../../../component/tooltip';
// eslint-disable-next-line no-duplicate-imports
import { TooltipResult } from '../../../component/tooltip';
import type { IComponentPlugin, IComponentPluginService } from '../interface';
import { BasePlugin } from '../../base/base-plugin';
import { getTooltipPatternValue } from '../../../component/tooltip/utils';
import type { IDimensionData, IDimensionInfo } from '../../../event/events/dimension/interface';
import type { ITooltipHandlerOptions } from './interface';
import type { ICompiler } from '../../../compile/interface/compilable-item';

type ChangeTooltipFunc = (visible: boolean, params: TooltipHandlerParams, data?: TooltipData) => TooltipResult;

type ChangeTooltipPositionFunc = (params: TooltipHandlerParams, data: TooltipData) => TooltipResult;

/**
 * The tooltip handler class.
 */
export abstract class BaseTooltipHandler extends BasePlugin implements ITooltipHandler, IComponentPlugin {
  static readonly pluginType: 'component';
  static readonly specKey = 'tooltip';

  readonly type: string;

  /** 是否可见 */
  protected _visible = true;

  // protected _style: ITooltipStyle = {};

  protected _option: ITooltipHandlerOptions;

  protected _chartOption: IChartOption;

  protected _env: RenderMode;
  public get env() {
    return this._env;
  }

  protected _component: Tooltip;

  protected _chartContainer: Maybe<HTMLElement>;
  protected _compiler: ICompiler;

  // tooltip 容器
  protected _container!: Maybe<IGroup | HTMLElement>;

  protected _isReleased: boolean = false;

  onAdd(service: IComponentPluginService<any>): void {
    super.onAdd(service);
    const component = service.component as Tooltip;
    this._component = component;
    this._chartOption = component.getOption() as any;
    this._env = this._chartOption.mode;
    this._chartContainer = this._chartOption.globalInstance.getContainer();
    this._compiler = component.getCompiler();
    this._initFromSpec();
  }

  showTooltip = (activeType: TooltipActiveType, data: TooltipData, params: TooltipHandlerParams) => {
    const { changePositionOnly } = params;

    if (changePositionOnly) {
      return this.changeTooltipPosition(params, data);
    }
    return this.changeTooltip(true, params, data);
  };

  /** 改变 tooltip 内容和位置（不带 throttle 版本），返回是否遇到异常 */
  protected changeTooltip: ChangeTooltipFunc = (visible: boolean, params: TooltipHandlerParams, data?: TooltipData) => {
    if (this._isReleased) {
      return TooltipResult.failed;
    }

    if (!visible) {
      /** 关闭 tooltip */
      this._updateTooltip(false, params);
      return TooltipResult.success;
    }

    return this.changeTooltipPosition(params, data);
  };

  /** 改变 tooltip 位置（不带 throttle 版本），返回是否遇到异常 */
  protected changeTooltipPosition: ChangeTooltipPositionFunc = (params: TooltipHandlerParams, data: TooltipData) => {
    if (this._isReleased) {
      return TooltipResult.failed;
    }

    const event = params.event as MouseEvent;
    const { tooltipSpec, activeTooltipSpec, changePositionOnly } = params;

    if (!activeTooltipSpec) {
      return TooltipResult.failed;
    }

    const activeType = activeTooltipSpec.activeType;

    /** 用户自定义逻辑 */
    if (activeTooltipSpec.handler) {
      return activeTooltipSpec.handler.showTooltip?.(activeType, data, params) ?? TooltipResult.success;
    }

    /** 默认逻辑 */
    const pattern = activeTooltipSpec;

    // 计算 tooltip 位置
    const position = this._getActualTooltipPosition(
      activeTooltipSpec,
      params,
      this._getTooltipBoxSize(activeTooltipSpec, changePositionOnly)
    );
    activeTooltipSpec.position = position;
    const updatePosition = activeTooltipSpec.updatePosition ?? tooltipSpec[activeType]?.updatePosition;

    if (updatePosition) {
      activeTooltipSpec.position = updatePosition(activeTooltipSpec.position, data, params);
    }

    // 判断 tooltip 可见性
    let tooltipVisible = pattern?.visible !== false;
    if (
      !data ||
      event.type === 'pointerout' ||
      !activeTooltipSpec.visible ||
      (!activeTooltipSpec.title && !activeTooltipSpec.content)
    ) {
      tooltipVisible = false;
    }

    this._updateTooltip(tooltipVisible, {
      ...params,
      changePositionOnly
    });
    return TooltipResult.success;
  };

  hideTooltip(params: TooltipHandlerParams): TooltipResult {
    return this.changeTooltip(false, params);
  }

  release(): void {
    const spec = this._component?.getSpec() ?? {};
    /** 用户自定义逻辑 */
    if (spec.handler) {
      spec.handler.release?.();
      return;
    }
    /** 默认逻辑 */
    this._removeTooltip();

    this._isReleased = true;
    this._chartOption = null;
    this._component = null;
  }

  /* -----需要子类继承的方法开始----- */

  protected abstract _updateTooltip(visible: boolean, params: TooltipHandlerParams): void;
  protected abstract _removeTooltip(): void;
  protected abstract _getTooltipBoxSize(
    actualTooltip: ITooltipActual,
    changePositionOnly: boolean
  ): IContainerSize | undefined;

  /* -----需要子类继承的方法结束----- */

  protected _getDefaultOption(): ITooltipHandlerOptions {
    const { offset } = this._component.getSpec();

    return offset
      ? {
          offsetX: offset.x ?? DEFAULT_OPTIONS.offsetX,
          offsetY: offset.y ?? DEFAULT_OPTIONS.offsetY
        }
      : DEFAULT_OPTIONS;
  }

  /**
   * 计算实际的 tooltip 位置
   */
  protected _getActualTooltipPosition = (
    actualTooltip: ITooltipActual,
    params: TooltipHandlerParams,
    tooltipBoxSize: IContainerSize | undefined
  ): ITooltipPositionActual => {
    const getCartesianCrosshairRect = this._chartOption.getRectByDimensionData;
    const { tooltipSpec } = params;
    const invalidPosition = {
      x: Infinity,
      y: Infinity
    };
    if (!tooltipSpec) {
      return invalidPosition;
    }
    const event = params.event as MouseEvent;
    const { activeType, data } = actualTooltip;
    const firstDim =
      activeType === 'dimension' ? (data as IDimensionInfo[])[0]?.data?.[0] : (data as IDimensionData[])?.[0];

    const { offsetX, offsetY } = this._option;

    const spec = tooltipSpec[activeType];
    const position = getTooltipPatternValue(spec?.position, data, params);
    const positionMode =
      getTooltipPatternValue(spec?.positionMode, data, params) ?? (activeType === 'mark' ? 'mark' : 'pointer');
    const { width: tooltipBoxWidth = 0, height: tooltipBoxHeight = 0 } = tooltipBoxSize ?? {};

    const isCanvas = tooltipSpec.renderMode === 'canvas';
    const canvasRect = params?.chart?.getCanvasRect();
    const canvasWidth = canvasRect?.width ?? DEFAULT_CHART_WIDTH;
    const canvasHeight = canvasRect?.height ?? DEFAULT_CHART_HEIGHT;
    let isFixedPosition = false;

    const containerSize = {
      width: 0,
      height: 0
    };
    let relativePosOffset = { x: 0, y: 0 };
    let tooltipParentElementRect: IPoint | DOMRect = { x: 0, y: 0 };
    let chartElementRect: DOMRect;
    let chartElementScale = 1;
    let tooltipParentElementScale = 1;
    const isBrowser = isTrueBrowser(this._env);

    if (isBrowser && !tooltipSpec.confine) {
      // 只有在 browser 模式下才可以获取到 window 对象
      containerSize.width = window.innerWidth;
      containerSize.height = window.innerHeight;
    } else {
      containerSize.width = canvasWidth;
      containerSize.height = canvasHeight;
    }
    if (isBrowser && !isCanvas) {
      const tooltipParentElement = this._getParentElement(tooltipSpec);
      tooltipParentElementRect = tooltipParentElement?.getBoundingClientRect?.() ?? invalidPosition;
      const chartElement = (this._compiler.getCanvas() ?? this._chartContainer) as HTMLElement;
      chartElementRect = chartElement?.getBoundingClientRect();
      relativePosOffset = {
        x: chartElementRect.x - tooltipParentElementRect.x,
        y: chartElementRect.y - tooltipParentElementRect.y
      };
      chartElementScale = getScale(chartElement, chartElementRect);
      tooltipParentElementScale = getScale(tooltipParentElement, tooltipParentElementRect as DOMRect);
    }
    const tooltipSizeScale = tooltipParentElementScale / chartElementScale;

    /* 一、计算 left、top、right、bottom */

    const calcPos: { top?: number; bottom?: number; left?: number; right?: number } = {};
    const pointerFixedPosition: {
      x: TooltipFixedPosition;
      y: TooltipFixedPosition;
    } = { x: position as any, y: position as any };
    const dimToPos = { x: ['left', 'right'], y: ['top', 'bottom'] };

    const processCartesianFixedPosition = ({ orient, mode, offset }: ITooltipPositionFixedValue, dim: 'x' | 'y') => {
      let dim1: number;
      let dim2: number;
      const model = params.model as ILayoutModel;
      const startPoint = model?.getLayoutStartPoint();
      const dimOffset = offset ?? (dim === 'x' ? offsetX : offsetY);

      if (mode === 'mark') {
        isFixedPosition = true;
        const markGraphic = params.item;
        const bounds = markGraphic?.AABBBounds as AABBBounds;
        if (bounds && startPoint) {
          dim1 = (dim === 'x' ? bounds.x1 : bounds.y1) + startPoint[dim];
          dim2 = (dim === 'x' ? bounds.x2 : bounds.y2) + startPoint[dim];
        }
      } else if (
        getCartesianCrosshairRect &&
        mode === 'crosshair' &&
        firstDim?.series?.coordinate === 'cartesian' &&
        firstDim.datum &&
        firstDim.datum.length
      ) {
        isFixedPosition = true;
        const rect = getCartesianCrosshairRect(firstDim, startPoint);
        if (rect) {
          dim1 = rect.start[dim];
          dim2 = rect.end[dim];
        }
      } else {
        pointerFixedPosition[dim] = orient;
      }

      if (isFixedPosition) {
        const posKey = dimToPos[dim][0] as TooltipPositionKeys;
        const boxSize = dim === 'x' ? tooltipBoxWidth : tooltipBoxHeight;
        switch (getPositionType(orient, dim)) {
          case -2:
            calcPos[posKey] = dim1 - boxSize * tooltipSizeScale - dimOffset;
            break;
          case -1.5:
            calcPos[posKey] = dim1 + dimOffset;
            break;
          case 0:
            calcPos[posKey] = (dim1 + dim2) / 2 - (boxSize * tooltipSizeScale) / 2;
            break;
          case -1:
            calcPos[posKey] = (dim1 + dim2) / 2 - boxSize * tooltipSizeScale - dimOffset;
            break;
          case 1:
            calcPos[posKey] = (dim1 + dim2) / 2 + dimOffset;
            break;
          case 1.5:
            calcPos[posKey] = dim2 - boxSize * tooltipSizeScale - dimOffset;
            break;
          case 2:
            calcPos[posKey] = dim2 + dimOffset;
            break;
        }
      }
    };
    const dims = ['x', 'y'] as ('x' | 'y')[];
    if (isObject(position)) {
      if (isGlobalTooltipPositionPattern(position)) {
        const {
          left: posLeft,
          right: posRight,
          top: posTop,
          bottom: posBottom
        } = position as IGlobalTooltipPositionPattern;
        calcPos.left = getActualTooltipPositionValue(posLeft, event);
        calcPos.top = getActualTooltipPositionValue(posTop, event);
        calcPos.right = getActualTooltipPositionValue(posRight, event);
        calcPos.bottom = getActualTooltipPositionValue(posBottom, event);
      } else if (isFixedTooltipPositionPattern(position)) {
        dims.forEach(dim => {
          const dimValue = position[dim];
          if (isNumber(dimValue) || isFunction(dimValue)) {
            calcPos[dimToPos[dim][0] as TooltipPositionKeys] = getActualTooltipPositionValue(
              dimValue as number | ((event: MouseEvent) => number),
              event
            );
          } else {
            processCartesianFixedPosition(dimValue as ITooltipPositionFixedValue, dim);
          }
        });
      }
    } else if (isValid(position)) {
      processCartesianFixedPosition({ orient: position, mode: positionMode } as ITooltipPositionFixedValue, 'x');
      processCartesianFixedPosition({ orient: position, mode: positionMode } as ITooltipPositionFixedValue, 'y');
    }

    const result: ITooltipPositionActual = { x: null, y: null };

    dims.forEach(dim => {
      /* 二、换算成 x 和 y */
      const boxSize = dim === 'x' ? tooltipBoxWidth : tooltipBoxHeight;
      const canvasSize = dim === 'x' ? canvasWidth : canvasHeight;
      const offset = dim === 'x' ? offsetX : offsetY;
      const posType = getPositionType(pointerFixedPosition[dim], dim);
      if (isValidNumber(calcPos[dimToPos[dim][0] as TooltipPositionKeys])) {
        result[dim] = calcPos[dimToPos[dim][0] as TooltipPositionKeys];
      } else if (isValidNumber(calcPos[dimToPos[dim][1] as TooltipPositionKeys])) {
        result[dim] = canvasSize - boxSize * tooltipSizeScale - calcPos[dimToPos[dim][1] as TooltipPositionKeys];
      } else {
        const value0 = dim === 'x' ? (event as any).canvasX : (event as any).canvasY;

        if (posType > 0) {
          result[dim] = value0 + offset;
        } else if (posType === 0) {
          result[dim] = value0 - (boxSize * tooltipSizeScale) / 2;
        } else {
          result[dim] = value0 - boxSize * tooltipSizeScale - offset;
        }
      }
      result[dim] *= chartElementScale;

      if (isBrowser) {
        result[dim] += relativePosOffset[dim];
      }
      result[dim] /= tooltipParentElementScale;

      /* 三、确保tooltip在视区内 */
      const containerDimSize = dim === 'x' ? containerSize.width : containerSize.height;
      const leftOrTop = tooltipSpec.confine
        ? -(tooltipParentElementRect[dim] - (chartElementRect?.[dim] ?? 0) / chartElementScale) /
          tooltipParentElementScale
        : -tooltipParentElementRect[dim] / tooltipParentElementScale;
      const rightOrBottom = containerDimSize / tooltipParentElementScale + leftOrTop - boxSize;

      // 处理左右
      if (posType !== 2 && result[dim] < leftOrTop) {
        // 优先检测left
        if (isFixedPosition) {
          result[dim] = leftOrTop;
        } else {
          if (posType === 0) {
            // 从居中 挪至 右侧
            result[dim] += offset + boxSize / 2;
          } else {
            // 从居左/左侧 挪至 居右/右侧
            result[dim] += offset * 2 + boxSize;
          }

          if (result[dim] > rightOrBottom) {
            // 位置不超出视区右界
            result[dim] = rightOrBottom;
          }
        }
      } else if (posType !== -2 && result[dim] > rightOrBottom) {
        // 优先检测right
        // 位置不超出视区右界
        if (isFixedPosition) {
          result[dim] = rightOrBottom;
        } else {
          if (posType === 0) {
            // 从居中 挪至 左侧
            result[dim] -= offset + boxSize / 2;
          } else {
            // 从居右/右侧 挪至 居左/左侧
            result[dim] -= offset * 2 + boxSize;
          }

          if (result[dim] < leftOrTop) {
            // 位置不超出视区左界
            result[dim] = leftOrTop;
          }
        }
      }
    });

    return result;
  };

  protected _getParentElement(spec: ITooltipSpec): HTMLElement {
    return spec.parentElement as any;
  }

  getTooltipContainer() {
    return this._container;
  }

  protected _initFromSpec() {
    this._option = this._getDefaultOption();
  }

  reInit() {
    this._initFromSpec();
  }
}
