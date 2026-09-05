import { Factory } from '../../core/factory';
import { BaseTrigger } from './base';
import type { IElementHighlightByLegendOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { ChartEvent } from '../../constant/event';
import { generateFilterValue } from './util';
import type { IMarkGraphic } from '../../mark/interface/common';
import type { BaseEventParams } from '../../event/interface';
import { removeGraphicState } from '../../util/graphic-state';

const type = 'element-highlight-by-legend';
const defaultOptions: Partial<IElementHighlightByLegendOptions> = {
  highlightState: STATE_VALUE_ENUM.STATE_HIGHLIGHT,
  blurState: STATE_VALUE_ENUM.STATE_BLUR,
  filterType: 'groupKey'
};

export class ElementHighlightByLegend
  extends BaseTrigger<IElementHighlightByLegendOptions>
  implements ITrigger<IElementHighlightByLegendOptions>
{
  static type: string = type;
  type: string = type;

  static defaultOptions = defaultOptions;
  constructor(options?: IElementHighlightByLegendOptions) {
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

  protected getEvents(): Array<{ type: string | string[]; handler: ITriggerEventHandler }> {
    return [
      {
        type: ChartEvent.legendItemHover,
        handler: this.handleStart
      },
      {
        type: ChartEvent.legendItemUnHover,
        handler: this.handleReset
      }
    ];
  }

  start(itemKey: any) {
    if (itemKey) {
      const filterValue = generateFilterValue(this.options as IElementHighlightByLegendOptions);

      const { interaction, highlightState, blurState } = this.options;
      const statedGraphics = interaction.getStatedGraphics(this);
      const newStatedGraphics: IMarkGraphic[] = [];

      this.getMarks().forEach(m => {
        m.getGraphics()?.forEach(g => {
          if (filterValue(g) === itemKey) {
            newStatedGraphics.push(g);
          }
        });
      });

      interaction.updateStates(this, newStatedGraphics, statedGraphics, highlightState, blurState);
      interaction.setStatedGraphics(this, newStatedGraphics);
    }
  }

  resetAll() {
    const { interaction, highlightState, blurState } = this.options;

    interaction.clearAllStatesOfTrigger(this, highlightState, blurState);

    interaction.setStatedGraphics(this, []);
  }

  reset(g?: IMarkGraphic) {
    const { highlightState, blurState, interaction } = this.options;

    if (g) {
      const statedGraphics = interaction.getStatedGraphics(this);
      if (statedGraphics && statedGraphics.includes(g)) {
        removeGraphicState(g, [highlightState, blurState]);
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
    const event = e.event;

    if (event) {
      this.start(event.detail?.data?.id);
    }
  };

  handleReset = (e: BaseEventParams) => {
    this.resetAll();
  };
}

export const registerElementHighlightByLegend = () => {
  Factory.registerInteractionTrigger(type, ElementHighlightByLegend);
};
