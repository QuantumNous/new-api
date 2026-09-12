import { Factory } from '../../core/factory';
import { BaseTrigger } from './base';
import type { IElementActiveOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import { TRIGGER_TYPE_ENUM } from './enum';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import type { IMarkGraphic } from '../../mark/interface';
import type { BaseEventParams } from '../../event/interface';
import { addGraphicState, removeGraphicState } from '../../util/graphic-state';

const defaultOptions: Partial<IElementActiveOptions> = {
  state: STATE_VALUE_ENUM.STATE_ACTIVE,
  trigger: 'pointerover',
  triggerOff: 'pointerout'
};

export class ElementActive extends BaseTrigger<IElementActiveOptions> implements ITrigger<IElementActiveOptions> {
  static type: string = TRIGGER_TYPE_ENUM.ELEMENT_ACTIVE;
  type: string = TRIGGER_TYPE_ENUM.ELEMENT_ACTIVE;

  static defaultOptions = defaultOptions;

  constructor(options?: IElementActiveOptions) {
    super(options);
    this.options = Object.assign({}, defaultOptions, options);

    this.updateMarkIdByState([this.options.state]);
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

  getStartState(): string {
    return this.options.state;
  }

  start(g: IMarkGraphic) {
    if (g) {
      const { state, interaction } = this.options;

      if (this.isGraphicInStateMark(g, state)) {
        addGraphicState(g, state, true);

        interaction.setStatedGraphics(this, [g]);
      }
    }
  }

  reset(graphic?: IMarkGraphic) {
    const { interaction, state } = this.options;

    const statedGraphics = interaction.getStatedGraphics(this);
    const g = graphic ?? statedGraphics?.[0];

    if (g && statedGraphics?.includes(g)) {
      removeGraphicState(g, state);
      interaction.setStatedGraphics(
        this,
        statedGraphics.filter(sg => sg !== g)
      );
    }
  }

  handleStart = (e: BaseEventParams) => {
    this.start(e.item);
  };

  handleReset = (e: BaseEventParams) => {
    this.reset(e.item);
  };
}

export const registerElementActive = () => {
  Factory.registerInteractionTrigger(ElementActive.type, ElementActive);
};
