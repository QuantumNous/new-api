import { error } from '../../../util/debug';
import type { IAxis } from '../../../component/axis/interface';
import type { RenderMode } from '../../../typings/spec/common';
import type {
  BaseEventParams,
  EventHandler,
  EventParamsDefinition,
  IComposedEvent,
  IEventDispatcher
} from '../../interface';
import type { IChart } from '../../../chart/interface';
import type { IDimensionInfo } from './interface';
import { getDimensionInfoByValue } from './util/cartesian';
import type { IOrientType, Maybe } from '../../../typings';
import { isDiscrete } from '@visactor/vscale';
import { isXAxis } from '../../../component/axis/cartesian/util';

export class DimensionEvent implements IComposedEvent {
  protected _eventDispatcher: IEventDispatcher;
  protected _mode: RenderMode;

  protected _callback!: (params: BaseEventParams) => void;

  protected _chart: Maybe<IChart>;

  constructor(eventDispatcher: IEventDispatcher, mode: RenderMode) {
    this._eventDispatcher = eventDispatcher;
    this._mode = mode;
  }

  private get chart() {
    if (!this._chart) {
      this._chart = this._eventDispatcher.globalInstance.getChart?.();
    }
    return this._chart;
  }

  register<Evt extends string>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>): void {
    (this.chart?.getOption().onError ?? error)('Method not implemented.');
  }
  unregister(): void {
    (this.chart?.getOption().onError ?? error)('Method not implemented.');
  }

  protected getTargetDimensionInfo(x: number, y: number): IDimensionInfo[] | null {
    const dimensionInfo = this.chart.getModelOption().getDimensionInfo?.(this.chart, { x, y }) ?? [];

    if (dimensionInfo.length === 0) {
      return null;
    }

    return dimensionInfo;
  }

  dispatch(v: unknown, opt: { filter?: (axis: IAxis) => boolean }) {
    // get all enable axis
    const axes = this.chart?.getAllComponents().filter(c => {
      if (c.specKey !== 'axes') {
        return false;
      }
      if (opt?.filter) {
        return opt.filter(<IAxis>c);
      }
      return true;
    }) as IAxis[];

    const discreteAxes = axes.filter(axis => {
      const scale = (<IAxis>axis).getScale();
      return isDiscrete(scale.type);
    });
    const dimAxes = discreteAxes.length
      ? discreteAxes
      : axes.filter(axis => {
          const orient = axis.getOrient();
          return isXAxis(orient as IOrientType) || orient === 'angle';
        });
    const dimensionInfo: IDimensionInfo[] = [];
    const getDimensionInfoByValue = this.chart?.getModelOption().getDimensionInfoByValue;

    if (getDimensionInfoByValue) {
      dimAxes.forEach(a => {
        const info = getDimensionInfoByValue(a as unknown as any, v);
        if (info) {
          dimensionInfo.push(info);
        }
      });
    }
    this._callback.call(null, {
      action: 'enter',
      dimensionInfo
    } as unknown as BaseEventParams);
    return dimensionInfo;
  }
}
