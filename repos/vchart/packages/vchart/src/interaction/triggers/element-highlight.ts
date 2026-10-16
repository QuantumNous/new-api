import { isString } from '@visactor/vutils';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import type { IElementHighlightOptions, ITrigger } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface/common';
import { BaseTrigger } from './base';
import { Factory } from '../../core/factory';
import type { GraphicEventType } from '@visactor/vrender-core';
import { TRIGGER_TYPE_ENUM } from './enum';
import type { BaseEventParams } from '../../event/interface';
import { removeGraphicState } from '../../util/graphic-state';

const defaultOptions: Partial<IElementHighlightOptions> = {
  highlightState: STATE_VALUE_ENUM.STATE_HIGHLIGHT,
  blurState: STATE_VALUE_ENUM.STATE_BLUR,
  trigger: 'pointerover',
  triggerOff: 'pointerout'
};

export class ElementHighlight
  extends BaseTrigger<IElementHighlightOptions>
  implements ITrigger<IElementHighlightOptions>
{
  static type: string = TRIGGER_TYPE_ENUM.ELEMENT_HIGHLIGHT;
  type: string = TRIGGER_TYPE_ENUM.ELEMENT_HIGHLIGHT;

  static defaultOptions = defaultOptions;

  protected _lastGraphic?: IMarkGraphic;

  constructor(options?: IElementHighlightOptions) {
    super(options);
    this.options = Object.assign({}, defaultOptions, options);

    this.updateMarkIdByState([this.options.highlightState, this.options.blurState]);
  }

  getStartState(): string {
    return this.options.highlightState;
  }

  getResetState(): string {
    return this.options.blurState;
  }
  protected _resetType?: 'view' | 'self';

  protected getEvents() {
    const triggerOff = this.options.triggerOff;
    const trigger = this.options.trigger;
    const events = [
      {
        type: trigger,
        handler: this.handleStart
      }
    ];

    let eventName = triggerOff;
    if (isString(triggerOff) && (triggerOff as string).includes('view:')) {
      eventName = (triggerOff as string).replace('view:', '') as GraphicEventType;
      this._resetType = 'view';
    } else {
      this._resetType = 'self';
    }

    events.push({ type: eventName as GraphicEventType, handler: this.handleReset });

    return events;
  }

  resetAll = (e?: BaseEventParams) => {
    const { highlightState, blurState, interaction } = this.options;

    if (this._lastGraphic) {
      interaction.clearAllStatesOfTrigger(this, highlightState, blurState);

      this.dispatchEvent('reset', { graphics: [this._lastGraphic], options: this.options, ...e });

      this._lastGraphic = null;

      interaction.setStatedGraphics(this, []);
    }
  };

  handleStart = (e: BaseEventParams) => {
    this.start(e.item, e);
  };

  handleReset = (e: BaseEventParams) => {
    const { interaction } = this.options;
    const statedGraphics = interaction.getStatedGraphics(this);

    if (!statedGraphics || !statedGraphics.length) {
      return;
    }
    const markGraphic = e.item;
    const hasActiveElement = markGraphic && this._markSet.getMarkInId(markGraphic.context.markId);

    if (this._resetType.includes('view') && !hasActiveElement) {
      this.resetAll(e);
    } else if (this._resetType.includes('self') && hasActiveElement) {
      this.resetAll(e);
    }
  };

  start(markGraphic: IMarkGraphic, e?: BaseEventParams) {
    if (markGraphic && this._markSet.getMarkInId(markGraphic.context.markId)) {
      const { highlightState, blurState, interaction } = this.options;

      if (this._lastGraphic === markGraphic) {
        return;
      }

      const newStatedGraphics = interaction.updateStates(
        this,
        [markGraphic],
        interaction.getStatedGraphics(this),
        highlightState,
        blurState
      );
      interaction.setStatedGraphics(this, newStatedGraphics);

      this._lastGraphic = markGraphic;

      this.dispatchEvent('start', { graphics: newStatedGraphics, options: this.options, ...e });
    } else if (this._lastGraphic && this._resetType === 'view') {
      this.resetAll(e);
    }
  }

  reset(markGraphic: IMarkGraphic, e?: BaseEventParams) {
    if (markGraphic) {
      if (this._markSet.getMarkInId(markGraphic.context.markId)) {
        removeGraphicState(markGraphic, [this.options.highlightState, this.options.blurState]);
      }
    } else {
      this.resetAll(e);
    }
  }
}

export const registerElementHighlight = () => {
  Factory.registerInteractionTrigger(ElementHighlight.type, ElementHighlight);
};
