import { isNil, isValid } from '@visactor/vutils';
import type { BaseEventParams } from '../../../event/interface';
import type { ITooltipActual, TooltipActiveType, TooltipData } from '../../../typings';
import type { ITooltip, TooltipHandlerParams } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { TooltipResult } from '../interface/common';
import type { MouseEventData, TooltipInfo } from './interface';
import { ChartEvent } from '../../../constant/event';
import type { TooltipEventParams } from '../interface/event';
import type { IDimensionInfo } from '../../../event/events/dimension/interface';
import type { ISeries } from '../../../series/interface';
import { getTooltipSpecForShow } from '../utils/get-spec';
import { isActiveTypeVisible } from '../utils/common';
import { TOOLTIP_MAX_LINE_COUNT, TOOLTIP_OTHERS_LINE } from '../constant';

export abstract class BaseTooltipProcessor {
  readonly component: ITooltip;
  abstract activeType: TooltipActiveType;

  protected _cacheActiveSpec: ITooltipActual | undefined;

  constructor(component: ITooltip) {
    this.component = component;
  }

  /** 触发对应类型的 tooltip */
  abstract showTooltip(info: TooltipInfo, params: BaseEventParams, changePositionOnly: boolean): TooltipResult;
  /** 获取触发 tooltip 需要的信息 */
  abstract getMouseEventData(params: BaseEventParams): MouseEventData;

  protected _showTooltipByHandler = (data: TooltipData | undefined, params: TooltipHandlerParams): TooltipResult => {
    if (isNil(data)) {
      return TooltipResult.failed;
    }

    if (!params.changePositionOnly) {
      this.clearCache();
    }

    // 更新 this._cacheActiveSpec
    this._updateViewSpec(data, params);
    const spec = this._cacheActiveSpec;
    if (isNil(spec) || spec.visible === false) {
      return TooltipResult.failed;
    }
    params.tooltipSpec = this.component.getSpec();
    params.activeTooltipSpec = spec;

    // 判断 tooltip 是否为空
    const { title, content } = spec;

    const isEmpty = isNil(title?.key) && isNil(title?.value) && !content?.length;
    // 触发事件
    this.component.event.emit(ChartEvent.tooltipShow, {
      ...params,
      isEmptyTooltip: isEmpty,
      tooltipData: data,
      activeType: this.activeType,
      tooltip: this.component
    } as TooltipEventParams);

    if (isEmpty) {
      return TooltipResult.failed;
    }

    // 显示 tooltip
    let showTooltip;
    if (spec.handler?.showTooltip) {
      showTooltip = spec.handler.showTooltip.bind(spec.handler);
    } else if (this.component.tooltipHandler?.showTooltip) {
      showTooltip = this.component.tooltipHandler.showTooltip.bind(this.component.tooltipHandler);
    }
    if (showTooltip) {
      return showTooltip(this.activeType, data, params) ?? TooltipResult.success;
    }
    return TooltipResult.failed;
  };

  protected _preprocessDimensionInfo(dimensionInfo?: IDimensionInfo[]): IDimensionInfo[] | undefined {
    const newDimensionInfo: IDimensionInfo[] = [];
    dimensionInfo?.forEach(info => {
      const di: IDimensionInfo = {
        ...info,
        data: info.data.filter(
          ({ series }: any) => series.getSpec()?.tooltip?.visible !== false // 过滤掉不需要显示的维度数据
        )
      };
      if (di.data.length > 0) {
        newDimensionInfo.push(di);
      }
    });
    if (newDimensionInfo.length > 0) {
      return newDimensionInfo;
    }
    return undefined;
  }

  /**
   * 合成实际显示的 tooltip spec
   * @param params
   */
  protected _updateViewSpec(data: TooltipData, params: TooltipHandlerParams) {
    const { changePositionOnly, model } = params;
    if (!changePositionOnly || !this._cacheActiveSpec) {
      const tooltipSpec = this.component.getSpec();
      /** spec 预处理 */
      this._cacheActiveSpec = getTooltipSpecForShow(
        this.activeType,
        this.component.getSpec(),
        model as ISeries,
        data,
        params
      );

      if (this._cacheActiveSpec) {
        if (isNil(this._cacheActiveSpec.handler) && isValid(tooltipSpec.handler)) {
          this._cacheActiveSpec.handler = tooltipSpec.handler;
        }
        const specByType = tooltipSpec[this.activeType] ?? {};
        const updateTitle = this._cacheActiveSpec.updateTitle ?? specByType.updateTitle;
        const updateContent = this._cacheActiveSpec.updateContent ?? specByType.updateContent;
        const maxLineCount = this._cacheActiveSpec.maxLineCount ?? specByType.maxLineCount ?? TOOLTIP_MAX_LINE_COUNT;

        if (updateTitle) {
          this._cacheActiveSpec.title =
            updateTitle(this._cacheActiveSpec.title, data, params) ?? this._cacheActiveSpec.title;
        }

        if (updateContent) {
          this._cacheActiveSpec.content =
            updateContent(this._cacheActiveSpec.content, data, params) ?? this._cacheActiveSpec.content;
        } else if (maxLineCount >= 1 && this._cacheActiveSpec.content?.length > maxLineCount) {
          const othersLine = this._cacheActiveSpec.othersLine ?? specByType.othersLine;
          const otherLine = othersLine
            ? {
                ...TOOLTIP_OTHERS_LINE,
                ...othersLine
              }
            : TOOLTIP_OTHERS_LINE;
          this._cacheActiveSpec.content = [
            ...this._cacheActiveSpec.content.slice(0, maxLineCount - 1),
            {
              ...this._cacheActiveSpec.content[maxLineCount - 1],
              ...otherLine
            }
          ];
        }
      }
    }
  }

  /** 判断是否应该触发 tooltip */
  shouldHandleTooltip(params: BaseEventParams, info: TooltipInfo): boolean {
    if (!this.component.enable) {
      return false;
    }
    if (isNil(info)) {
      return false;
    }

    return isActiveTypeVisible(this.activeType, (params.model as ISeries)?.tooltipHelper?.spec);
  }

  clearCache() {
    this._cacheActiveSpec = undefined;
  }
}
