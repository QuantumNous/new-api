import { BaseTooltipModel } from './base-tooltip-model';
import { ContentColumnModel } from './content-column-model';
import type { Maybe } from '@visactor/vutils';
export declare class ContentModel extends BaseTooltipModel {
    shapeBox: Maybe<ContentColumnModel>;
    keyBox: Maybe<ContentColumnModel>;
    valueBox: Maybe<ContentColumnModel>;
    init(): void;
    private _initShapeBox;
    private _initKeyBox;
    private _initValueBox;
    setStyle(style?: Partial<CSSStyleDeclaration>): void;
    setContent(): void;
    release(): void;
}
