import { Factory } from '../../core/factory';
import { BaseTrigger } from './base';
import type { IElementHighlightOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface';
import { isNil } from '@visactor/vutils';
import type { BaseEventParams } from '../../core';
import { highlightDefaultOptions } from './util';
import { removeGraphicState } from '../../util/graphic-state';

const type = 'element-highlight-by-group';

export class ElementHighlightByGroup
  extends BaseTrigger<IElementHighlightOptions>
  implements ITrigger<IElementHighlightOptions>
{
  static type: string = type;
  type: string = type;

  static defaultOptions = highlightDefaultOptions;
  constructor(options?: IElementHighlightOptions) {
    super(options);
    this.options = Object.assign({}, highlightDefaultOptions, options);

    this.updateMarkIdByState([this.options.highlightState, this.options.blurState]);
  }

  getStartState(): string {
    return this.options.highlightState;
  }

  getResetState(): string {
    return this.options.blurState;
  }

  protected getEvents(): Array<{ type: string | string[]; handler: ITriggerEventHandler }> {
    return [
      {
        type: this.options.trigger,
        handler: this.handleStart
      },
      { type: this.options.triggerOff, handler: this.handleReset }
    ];
  }

  resetAll() {
    const { interaction, highlightState, blurState } = this.options;

    interaction.clearAllStatesOfTrigger(this, highlightState, blurState);

    interaction.setStatedGraphics(this, []);
  }

  protected _getHightlightKey(g: IMarkGraphic) {
    return g.context?.groupKey;
  }

  start(g: IMarkGraphic) {
    if (g && this.isGraphicInMark(g)) {
      const highlightKey = this._getHightlightKey(g);

      if (isNil(highlightKey)) {
        return;
      }

      const { interaction, highlightState, blurState } = this.options;
      const statedGraphics = interaction.getStatedGraphics(this);
      const newStatedGraphics: IMarkGraphic[] = [];

      this.getMarks().forEach(m => {
        m.getGraphics()?.forEach(g => {
          if (this._getHightlightKey(g) === highlightKey) {
            newStatedGraphics.push(g);
          }
        });
      });

      interaction.updateStates(this, newStatedGraphics, statedGraphics, highlightState, blurState);
      interaction.setStatedGraphics(this, newStatedGraphics);
    }
  }

  reset(g?: IMarkGraphic) {
    if (g) {
      if (this.isGraphicInMark(g)) {
        const { interaction } = this.options;
        const statedGraphics = interaction.getStatedGraphics(this);

        removeGraphicState(g, [this.options.highlightState, this.options.blurState]);

        interaction.setStatedGraphics(
          this,
          statedGraphics.filter(sg => sg !== g)
        );
      }
    } else {
      this.resetAll();
    }
  }

  handleStart = (e: BaseEventParams) => {
    this.start(e.item);
  };

  handleReset = (e: BaseEventParams) => {
    const g = e.item;
    const hasActiveElement = g && this.isGraphicInMark(g);

    if (hasActiveElement) {
      this.resetAll();
    }
  };
}

export const registerElementHighlightByGroup = () => {
  Factory.registerInteractionTrigger(type, ElementHighlightByGroup);
};
