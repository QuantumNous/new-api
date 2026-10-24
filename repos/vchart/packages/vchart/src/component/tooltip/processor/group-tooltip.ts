import type { BaseEventParams } from '../../../event/interface';
import type { Datum, IGroupTooltipPattern, TooltipActiveType } from '../../../typings';
import type { ITooltipSpec, TooltipHandlerParams } from '../interface';
import type { GroupTooltipInfo, MouseEventData } from './interface';
import { BaseTooltipProcessor } from './base';
import { array } from '@visactor/vutils';
import type { ISeries } from '../../../series/interface';
import { Factory } from '../../../core/factory';
import { TooltipType } from '../constant';

export class GroupTooltipProcessor extends BaseTooltipProcessor {
  activeType: TooltipActiveType = 'group';

  /** 触发对应类型的 tooltip */
  showTooltip(info: GroupTooltipInfo, params: BaseEventParams, changePositionOnly: boolean) {
    const { datum, series } = info;
    const tooltipData = [{ datum: array(datum), series }];
    const newParams: TooltipHandlerParams = {
      ...(params as any),
      groupDatum: this._getGroupDatum(params),
      changePositionOnly,
      tooltip: this.component
    };
    return this._showTooltipByHandler(tooltipData, newParams);
  }

  /** 获取触发 tooltip 需要的信息 */
  getMouseEventData(params: BaseEventParams): MouseEventData {
    let info: GroupTooltipInfo | undefined;

    // 处理mark info
    if (params.model?.modelType === 'series') {
      const series = params.model as ISeries;
      const helper = series.tooltipHelper;
      const activeTriggers = helper?.activeTriggerSet.group;

      if (activeTriggers?.has(params.mark)) {
        const patternSpec: IGroupTooltipPattern = (this.component.getSpec() as ITooltipSpec)[this.activeType];
        const triggerMark = patternSpec?.triggerMark ? array(patternSpec.triggerMark) : [];
        if (triggerMark.includes(params.mark?.name as any)) {
          info = {
            mark: params.mark,
            datum: params.datum,
            series
          };
        }
      }
    }

    return {
      tooltipInfo: info,
      ignore: false
    };
  }

  protected _getGroupDatum(params: BaseEventParams) {
    const { model, mark, datum } = params;
    const series = model as ISeries;
    if (['line', 'area'].includes(mark.type)) {
      return array(datum);
    }

    const datumList = series.getViewData().latestData;
    const seriesField = series.getSeriesField();
    if (!seriesField) {
      return datumList;
    }

    const seriesFieldValue = array(datum)[0][seriesField];
    return datumList.filter((d: Datum) => d[seriesField] === seriesFieldValue);
  }
}

export const registerGroupTooltipProcessor = () => {
  Factory.registerTooltipProcessor(TooltipType.group, GroupTooltipProcessor);
};
