import { isArray } from '@visactor/vutils';
import type { IBaseTriggerOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import type { IMark, IMarkGraphic } from '../../mark/interface/common';
import { MarkSet } from '../../mark/mark-set';
import { groupMarksByState } from './util';
import type { BaseEventParams } from '../../core';

export abstract class BaseTrigger<T extends IBaseTriggerOptions> implements ITrigger<T> {
  options: T;
  type: string;

  protected _markSet: MarkSet = new MarkSet();

  protected _markIdByState: Record<string, number[]>;

  constructor(options: T) {
    this.options = options;

    if (options.marks && options.marks.length) {
      options.marks.forEach(m => {
        this.registerMark(m);
      });
    }
  }

  getMarks(): IMark[] {
    return this._markSet.getMarks();
  }

  getMarksByState(state: string): IMark[] {
    if (this._markIdByState && this._markSet) {
      const markIds = this._markIdByState[state];

      return markIds ? this.getMarks().filter(mark => mark && markIds.includes(mark.id)) : [];
    }

    return [];
  }

  registerMark(mark: IMark | IMark[]) {
    if (isArray(mark)) {
      mark.forEach(m => {
        this._markSet.addMark(m);
      });
    } else {
      this._markSet.addMark(mark);
    }
  }

  updateMarkIdByState(states: string[]) {
    this._markIdByState = groupMarksByState(this.getMarks(), states);
  }

  getMarkIdByState() {
    return this._markIdByState ?? {};
  }

  isGraphicInStateMark(g: IMarkGraphic, state: string) {
    const markIdByState = this.getMarkIdByState();

    return markIdByState && markIdByState[state] && markIdByState[state].includes(g.context?.markId);
  }

  isGraphicInMark(g: IMarkGraphic) {
    return !!this._markSet.getMarkInId(g.context?.markId);
  }

  protected abstract getEvents(): Array<{ type: string | string[]; handler: ITriggerEventHandler }>;

  getStartState(): string {
    return null;
  }

  getResetState(): string {
    return null;
  }

  init() {
    const events = this.getEvents();

    if (events && this.options.event) {
      events.forEach(evt => {
        if (evt.type && evt.handler) {
          if (isArray(evt.type)) {
            evt.type.forEach(evtType => {
              evtType && evtType !== 'none' && this.options.event.on(evtType, evt.handler);
            });
          } else {
            evt.type !== 'none' && this.options.event.on(evt.type, evt.handler);
          }
        }
      });
    }
  }

  release() {
    // unbind events
    const events = this.getEvents();

    if (events && this.options.event) {
      (events ?? []).forEach(evt => {
        if (evt.type && evt.handler) {
          if (isArray(evt.type)) {
            evt.type.forEach(evtType => {
              evtType && evtType !== 'none' && this.options.event.on(evtType, evt.handler);
            });
          } else {
            evt.type !== 'none' && this.options.event.off(evt.type, evt.handler);
          }
        }
      });
    }
  }

  start(g: IMarkGraphic | string, e?: BaseEventParams) {
    // do nothing
  }

  reset(g?: IMarkGraphic, e?: BaseEventParams) {
    // do nothing
  }

  protected dispatchEvent(type: 'start' | 'reset' | 'update' | 'end', params: any) {
    if (this.options.event) {
      this.options.event.emit(`${this.type}:${type}`, params);

      if (type === 'start' && this.options.onStart) {
        this.options.onStart(params);
      } else if (type === 'reset' && this.options.onReset) {
        this.options.onReset(params);
      } else if (type === 'update' && this.options.onUpdate) {
        this.options.onUpdate(params);
      } else if (type === 'end' && this.options.onEnd) {
        this.options.onEnd(params);
      }
    }
  }
}
