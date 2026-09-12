import type { IElementHighlightOptions, ITrigger } from '../interface/trigger';
import { ElementHighlightByGroup } from './element-highlight-by-group';
import type { IMarkGraphic } from '../../mark/interface/common';
export declare class ElementHighlightByKey extends ElementHighlightByGroup implements ITrigger<IElementHighlightOptions> {
    static type: string;
    type: string;
    protected _getHightlightKey(g: IMarkGraphic): string;
}
export declare const registerElementHighlightByKey: () => void;
