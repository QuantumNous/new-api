import type { IComposedTextMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkGraphic, IMarkOption, IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface';
import type { ITextMark, ITextSpec } from './interface/mark';
import type { IGraphic, IRichTextGraphicAttribute, ITextGraphicAttribute } from '@visactor/vrender-core';
export declare class TextMark extends BaseMark<IComposedTextMarkSpec> implements ITextMark {
    static readonly type = MarkTypeEnum.text;
    readonly type = MarkTypeEnum.text;
    protected _textType: 'text' | 'rich';
    getTextType(): "text" | "rich";
    constructor(name: string, option: IMarkOption);
    protected _getDefaultStyle(): IMarkStyle<IComposedTextMarkSpec>;
    initStyleWithSpec(spec: ITextSpec<IComposedTextMarkSpec>): void;
    protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any): any;
    protected _createGraphic(attrs?: ITextGraphicAttribute | IRichTextGraphicAttribute): IGraphic;
}
export declare const registerTextMark: () => void;
