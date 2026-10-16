import type { Maybe } from '@visactor/vutils';
import { BaseTooltipModel } from './base-tooltip-model';
import { ShapeModel } from './shape-model';
import { TextModel } from './text-model';
export declare class TitleModel extends BaseTooltipModel {
    shape: Maybe<ShapeModel>;
    textSpan: Maybe<TextModel>;
    init(): void;
    private _initShape;
    private _releaseShape;
    private _initTextSpan;
    setStyle(style?: Partial<CSSStyleDeclaration>): void;
    setContent(): void;
    release(): void;
}
