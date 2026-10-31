import { Factory } from '../../core/factory';
import { BaseTrigger } from './base';
import type { IElementHighlightByNameOptions, ITrigger } from '../interface/trigger';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import type { BaseEventParams } from '../../event/interface';
import { array } from '@visactor/vutils';
import type { IMarkGraphic } from '../../mark/interface';
import { generateFilterValue } from './util';
import { removeGraphicState } from '../../util/graphic-state';

const type = 'element-highlight-by-name';
const defaultOptions: Partial<IElementHighlightByNameOptions> = {
  highlightState: STATE_VALUE_ENUM.STATE_HIGHLIGHT,
  blurState: STATE_VALUE_ENUM.STATE_BLUR,
  filterType: 'groupKey'
};

export class ElementHighlightByName
  extends BaseTrigger<IElementHighlightByNameOptions>
  implements ITrigger<IElementHighlightByNameOptions>
{
  static type: string = type;
  type: string = type;

  static defaultOptions = defaultOptions;
  constructor(options?: IElementHighlightByNameOptions) {
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

  protected getEvents() {
    return [
      {
        type: this.options.trigger,
        handler: this.handleStart
      },
      { type: this.options.triggerOff, handler: this.handleReset }
    ];
  }

  protected _filterByName(e: BaseEventParams) {
    const names = array(this.options.graphicName);

    return e?.node?.name && names.includes(e.node.name);
  }

  protected _parseTargetKey(e: BaseEventParams) {
    return this.options.parseData
      ? this.options.parseData(e)
      : e.node.type === 'text'
      ? (e.node.attribute as any).text
      : null;
  }

  start(itemKey: any) {
    if (itemKey) {
      const filterValue = generateFilterValue(this.options as IElementHighlightByNameOptions);

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
    const shoudStart = this.options.shouldStart ? this.options.shouldStart(e) : this._filterByName(e);

    if (shoudStart) {
      const itemKey = this._parseTargetKey(e);
      this.start(itemKey);
    }
  };

  handleReset = (e: BaseEventParams) => {
    const shoudReset = this.options.shouldReset ? this.options.shouldReset(e) : this._filterByName(e);

    if (shoudReset) {
      this.resetAll();
    }
  };
}

export const registerElementHighlightByName = () => {
  Factory.registerInteractionTrigger(type, ElementHighlightByName);
};
