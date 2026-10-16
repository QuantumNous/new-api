import { ElementHighlight, Factory, type BaseEventParams, type IMarkGraphic } from '@visactor/vchart';
import { isNil } from '@visactor/vchart';

const type = 'element-highlight-by-graphic-name';

export class ElementHighlightByGraphicName extends ElementHighlight {
  static type: string = type;
  type: string = type;

  protected _filterByName(e: BaseEventParams) {
    const name = e?.node?.name;
    return !!name;
  }

  protected _parseTargetKey(e: BaseEventParams) {
    return e.node.name;
  }

  start(itemKey: any) {
    if (isNil(itemKey)) {
      return;
    }

    const { interaction, highlightState, blurState } = this.options;
    const statedGraphics = interaction.getStatedGraphics(this);
    const newStatedGraphics: IMarkGraphic[] = [];

    this.getMarks().forEach(m => {
      m.getGraphics()?.forEach(g => {
        if (g.name === itemKey) {
          newStatedGraphics.push(g);
        }
      });
    });

    interaction.updateStates(this, newStatedGraphics, statedGraphics, highlightState, blurState);
    interaction.setStatedGraphics(this, newStatedGraphics);
  }

  reset() {
    const { highlightState, blurState, interaction } = this.options;

    interaction.clearAllStatesOfTrigger(this, highlightState, blurState);
    interaction.setStatedGraphics(this, []);
  }

  handleStart = (e: BaseEventParams) => {
    if (e && e.item && this.isGraphicInMark(e.item)) {
      const shouldStart = this.options.shouldStart ? this.options.shouldStart(e) : this._filterByName(e);
      if (shouldStart) {
        const itemKey = this._parseTargetKey(e);
        this.start(itemKey);
      }
    }
  };

  handleReset = (e: BaseEventParams) => {
    if (e && e.item && this.isGraphicInMark(e.item)) {
      this.reset();
    }
  };
}

export const registerElementHighlightByGraphicName = () => {
  Factory.registerInteractionTrigger(ElementHighlightByGraphicName.type, ElementHighlightByGraphicName);
};
