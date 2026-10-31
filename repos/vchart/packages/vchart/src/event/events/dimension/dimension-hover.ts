import { isMobileLikeMode } from '../../../util/env';
import type { BaseEventParams, EventHandler, EventParamsDefinition, EventType } from '../../interface';
import { DimensionEvent } from './base';
import { isSameDimensionInfo } from './util/common';
import { Event_Source_Type } from '../../../constant/event';
import type { IDimensionInfo } from './interface';

export class DimensionHoverEvent extends DimensionEvent {
  private _cacheDimensionInfo: IDimensionInfo[] | null = null;

  register<Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>) {
    this._callback = handler.callback;

    this._eventDispatcher.register<'pointermove'>('pointermove', {
      query: { ...handler.query, source: Event_Source_Type.chart },
      callback: this.onMouseMove
    });

    this._eventDispatcher.register<'pointerout'>('pointerout', {
      query: { ...handler.query, source: Event_Source_Type.canvas },
      callback: this.onMouseOut
    });

    if (isMobileLikeMode(this._mode)) {
      // 移动端点按也触发 hover
      this._eventDispatcher.register<'pointerdown'>('pointerdown', {
        query: { ...handler.query, source: Event_Source_Type.chart },
        callback: this.onMouseMove
      });
    }
  }

  unregister() {
    this._eventDispatcher.unregister('pointermove', {
      query: null,
      callback: this.onMouseMove
    });

    if (isMobileLikeMode(this._mode)) {
      // 移动端点按也出发 hover
      this._eventDispatcher.unregister('pointerdown', {
        query: null,
        callback: this.onMouseMove
      });
    }
  }

  private onMouseMove = (params: BaseEventParams) => {
    if (!params || params.chart?.getOption()?.globalInstance?.disableDimensionHoverEvent?.()) {
      return;
    }
    const x = (params.event as any).viewX;
    const y = (params.event as any).viewY;
    const targetDimensionInfo = this.getTargetDimensionInfo(x, y);
    if (targetDimensionInfo === null && this._cacheDimensionInfo !== null) {
      // 鼠标移出某维度
      this._callback.call(null, {
        ...params,
        action: 'leave',
        dimensionInfo: this._cacheDimensionInfo.slice()
      });
      this._cacheDimensionInfo = targetDimensionInfo;
    } else if (
      targetDimensionInfo !== null &&
      (this._cacheDimensionInfo === null ||
        targetDimensionInfo.length !== this._cacheDimensionInfo.length ||
        targetDimensionInfo.some((info, i) => !isSameDimensionInfo(info, this._cacheDimensionInfo![i])))
    ) {
      // 鼠标移入某维度
      this._callback.call(null, {
        ...params,
        action: 'enter',
        dimensionInfo: targetDimensionInfo.slice()
      });
      this._cacheDimensionInfo = targetDimensionInfo;
    } else if (targetDimensionInfo !== null) {
      // 鼠标在某维度上滑动
      this._callback.call(null, {
        ...params,
        action: 'move',
        dimensionInfo: targetDimensionInfo.slice()
      });
    }
  };

  private onMouseOut = (params: BaseEventParams) => {
    if (!params || params.chart?.getOption()?.globalInstance?.disableDimensionHoverEvent?.()) {
      return;
    }
    // 鼠标移出某维度
    this._callback.call(null, {
      ...params,
      action: 'leave',
      dimensionInfo: this._cacheDimensionInfo ? this._cacheDimensionInfo.slice() : []
    });
    this._cacheDimensionInfo = null;
  };
}
