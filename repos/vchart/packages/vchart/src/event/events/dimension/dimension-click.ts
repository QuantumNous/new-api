import { Event_Source_Type } from '../../../constant/event';
import type { BaseEventParams, EventHandler, EventParamsDefinition, EventType } from '../../interface';
import { DimensionEvent } from './base';

export class DimensionClickEvent extends DimensionEvent {
  register<Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>) {
    this._callback = handler.callback;

    this._eventDispatcher.register<'pointertap'>('pointertap', {
      query: { ...handler.query, source: Event_Source_Type.chart },
      callback: this.onClick
    });
  }

  unregister() {
    this._eventDispatcher.unregister('pointertap', {
      query: null,
      callback: this.onClick
    });
  }

  private onClick = (params: BaseEventParams) => {
    if (!params) {
      return;
    }
    const x = (params.event as any).viewX;
    const y = (params.event as any).viewY;
    const targetDimensionInfo = this.getTargetDimensionInfo(x, y);
    if (!targetDimensionInfo) {
      return;
    }
    this._callback.call(null, {
      ...params,
      action: 'click',
      dimensionInfo: targetDimensionInfo.slice()
    });
  };
}
