import { Factory } from '../../core/factory';
import { BaseTrigger } from './base';
import type { IElementActiveByLegendOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import { ChartEvent } from '../../constant/event';
import { isNil } from '@visactor/vutils';
import { generateFilterValue } from './util';
import type { IMarkGraphic } from '../../mark/interface';
import type { BaseEventParams } from '../../core';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { removeGraphicState } from '../../util/graphic-state';

const type = 'element-active-by-legend';
const defaultOptions: Partial<IElementActiveByLegendOptions> = {
  state: STATE_VALUE_ENUM.STATE_ACTIVE,
  filterType: 'groupKey'
};

export class ElementActiveByLegend
  extends BaseTrigger<IElementActiveByLegendOptions>
  implements ITrigger<IElementActiveByLegendOptions>
{
  static type: string = type;
  type: string = type;

  static defaultOptions = defaultOptions;

  constructor(options?: IElementActiveByLegendOptions) {
    super(options);
    this.options = Object.assign({}, defaultOptions, options);

    this.updateMarkIdByState([this.options.state]);
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

  getStartState(): string {
    return this.options.state;
  }
  start(itemKey: string) {
    if (isNil(itemKey)) {
      return;
    }
    const { interaction, state } = this.options;
    const filterValue = generateFilterValue(this.options);
    const statedGraphics = interaction.getStatedGraphics(this);
    const newStatedGraphics: IMarkGraphic[] = [];

    this.getMarks().forEach(m => {
      m.getGraphics()?.forEach(g => {
        if (filterValue(g) === itemKey) {
          newStatedGraphics.push(g);
        }
      });
    });

    interaction.updateStates(this, newStatedGraphics, statedGraphics, state);
    interaction.setStatedGraphics(this, newStatedGraphics);
  }

  resetAll() {
    const { interaction, state } = this.options;

    interaction.clearAllStatesOfTrigger(this, state);

    interaction.setStatedGraphics(this, []);
  }

  reset(g?: IMarkGraphic) {
    const { state, interaction } = this.options;

    if (g) {
      const statedGraphics = interaction.getStatedGraphics(this);
      if (statedGraphics && statedGraphics.includes(g)) {
        removeGraphicState(g, state);
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

export const registerElementActiveByLegend = () => {
  Factory.registerInteractionTrigger(type, ElementActiveByLegend);
};
