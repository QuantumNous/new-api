import { Factory } from '../../core/factory';
import type { IElementHighlightOptions, ITrigger } from '../interface/trigger';
import { ElementHighlightByGroup } from './element-highlight-by-group';
import type { IMarkGraphic } from '../../mark/interface/common';

const type = 'element-highlight-by-key';

export class ElementHighlightByKey extends ElementHighlightByGroup implements ITrigger<IElementHighlightOptions> {
  static type: string = type;
  type: string = type;

  protected _getHightlightKey(g: IMarkGraphic) {
    return g.context?.key;
  }
}

export const registerElementHighlightByKey = () => {
  Factory.registerInteractionTrigger(type, ElementHighlightByKey);
};
