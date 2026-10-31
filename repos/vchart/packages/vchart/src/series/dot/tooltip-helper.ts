import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type {
  Datum,
  ITooltipActual,
  ITooltipLineActual,
  ITooltipLinePattern,
  MaybeArray,
  TooltipActiveType,
  TooltipData,
  TooltipPatternProperty
} from '../../typings';
import { TimeUtil } from '@visactor/vutils';
import type { ITooltipSpec } from '../../component/tooltip/interface/spec';
import type { TooltipHandlerParams } from '../../component/tooltip/interface/common';

export class DotSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  protected enableByType(activeType: TooltipActiveType): boolean {
    return activeType === 'mark';
  }

  protected getDefaultTitlePattern(activeType: TooltipActiveType): ITooltipLinePattern {
    return {
      key: 'event info',
      value: 'event info'
    };
  }

  shapeTypeCallback = () => {
    return 'square';
  };

  protected getDefaultContentList(): MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>> {
    return [
      {
        key: (datum: any) => datum.type,
        value: (datum: any) => datum.id
      },
      {
        key: 'event_time',
        value: (datum: any) => TimeUtil.getInstance().timeFormat('%Y%m%d', datum.event_time)
      },
      {
        key: 'action_type',
        value: (datum: any) => datum.action_type
      },
      {
        key: 'children',
        value: (datum: any) => {
          return datum.children;
        }
      }
    ];
  }

  getTooltipData(
    activeType: TooltipActiveType,
    chartTooltipSpec?: ITooltipSpec,
    data?: TooltipData,
    datum?: Datum[],
    params?: TooltipHandlerParams
  ): ITooltipActual | null {
    const res = super.getTooltipData(activeType, chartTooltipSpec, data, datum, params);
    const userUpdateContent = this.spec?.[activeType]?.updateContent ?? chartTooltipSpec?.[activeType]?.updateContent;

    if (res && !userUpdateContent) {
      res.updateContent = (prev: any, datum: any, params: any) => {
        const childrenContent: ITooltipLineActual[] = [];
        const childrenPrev = prev.filter((p: any) => p.key === 'children');

        childrenPrev.length > 0 &&
          childrenPrev[0].value.forEach((element: any) => {
            let flag = true;
            for (const key in element) {
              childrenContent.push({
                ...childrenPrev[0],
                shapeType: 'circle',
                hasShape: flag,
                key: key,
                value: element[key] + ''
              } as ITooltipLineActual);
              flag = false;
            }
          });
        return prev.concat(childrenContent);
      };
    }

    return res;
  }
}
