import type { BaseEventParams } from '../../../event/interface';
import type { TooltipActiveType } from '../../../typings';
import type { ITooltipSpec, TooltipHandlerParams } from '../interface';
import type { MarkTooltipInfo, MouseEventData } from './interface';
import { BaseTooltipProcessor } from './base';
import type { ISeries } from '../../../series/interface';
import { IContainPointMode } from '@visactor/vrender-core';
import type { IDimensionData } from '../../../event/events/dimension/interface';
import type { Label } from '../../label';
import { getDatumOfGraphic } from '../../../util/mark';
import { Factory } from '../../../core/factory';
import { TooltipType } from '../constant';

export class MarkTooltipProcessor extends BaseTooltipProcessor {
  activeType: TooltipActiveType = 'mark';

  /** 触发对应类型的 tooltip */
  showTooltip(info: MarkTooltipInfo, params: BaseEventParams, changePositionOnly: boolean) {
    const { datum, series } = info;
    const tooltipSpec = this.component.getSpec();
    const tooltipData = [{ datum: [datum], series }];
    const helper = series.tooltipHelper;
    const seriesSpec = series.getSpec()?.tooltip as ITooltipSpec;
    const seriesCheckOverlap = seriesSpec?.mark?.checkOverlap;
    let checkOverlap = false;

    if (seriesCheckOverlap === true || (tooltipSpec.mark?.checkOverlap === true && seriesCheckOverlap !== false)) {
      const activeTriggers = helper?.activeTriggerSet.mark;

      if (activeTriggers) {
        checkOverlap = true;
        const chart = this.component.getChart();
        // compute layer offset
        const layer = chart.getCompiler().getStage().getLayer(undefined);
        const point = { x: params.event.viewX, y: params.event.viewY };
        layer.globalTransMatrix.transformPoint({ x: params.event.viewX, y: params.event.viewY }, point);

        activeTriggers.forEach(mark => {
          mark.getGraphics().forEach(g => {
            if (
              g !== params.node &&
              g &&
              g.containsPoint(point.x, point.y, IContainPointMode.GLOBAL, g.stage.getPickerService())
            ) {
              tooltipData[0].datum.push(getDatumOfGraphic(g));
            }
          });
        });
      }
    }

    const newParams: TooltipHandlerParams = {
      ...(params as any),
      model: series, // 在 label 支持 mark tooltip 后，eventParam.model 可能是 label 组件，而 tooltip 中需要的是 series
      changePositionOnly,
      tooltip: this.component
    };
    if (changePositionOnly && checkOverlap) {
      const cacheData = this._cacheActiveSpec && this._cacheActiveSpec.data;

      if (
        !cacheData ||
        (cacheData as IDimensionData[])[0].series !== tooltipData[0].series ||
        (cacheData as IDimensionData[])[0].datum.length !== tooltipData[0].datum.length ||
        (cacheData as IDimensionData[])[0].datum.some((d, index) => d !== tooltipData[0].datum[index])
      ) {
        newParams.changePositionOnly = false;
      }
    }
    return this._showTooltipByHandler(tooltipData, newParams);
  }

  /** 获取触发 tooltip 需要的信息 */
  getMouseEventData(params: BaseEventParams): MouseEventData {
    let info: MarkTooltipInfo | undefined;
    let ignore: boolean | undefined;

    const modelType = params.model?.modelType;
    // 处理mark info
    if (modelType === 'series') {
      const series = params.model as ISeries;
      const helper = series.tooltipHelper;
      const activeTriggers = helper?.activeTriggerSet.mark;
      const ignoreTriggers = helper?.ignoreTriggerSet.mark;
      if (activeTriggers?.has(params.mark)) {
        info = {
          mark: params.mark,
          datum: params.datum,
          series
        };
      } else if (ignoreTriggers?.has(params.mark)) {
        ignore = true;
      }
    } else if (modelType === 'component') {
      const model = params.model as Label;
      const node = params.node;
      if (model.name === 'label' && node) {
        const labelInfo = model.getLabelInfoByTextGraphic(node);
        const { baseMark, series, labelMark } = labelInfo ?? {};
        const helper = series.tooltipHelper;
        const activeTriggers = helper?.activeTriggerSet.mark;
        const ignoreTriggers = helper?.ignoreTriggerSet.mark;
        if (activeTriggers?.has(labelMark)) {
          info = {
            mark: baseMark as any, // 标签的 tooltip 与其关联图元保持一致
            datum: (node.attribute as any).data,
            series
          };
        } else if (ignoreTriggers?.has(labelMark)) {
          ignore = true;
        }
      }
    }
    return {
      tooltipInfo: info,
      ignore
    };
  }
}

export const registerMarkTooltipProcessor = () => {
  Factory.registerTooltipProcessor(TooltipType.mark, MarkTooltipProcessor);
};
