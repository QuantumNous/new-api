import type { ISymbolMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkGraphic, IMarkStyle, ISymbolMark } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class SymbolMark extends BaseMark<ISymbolMarkSpec> implements ISymbolMark {
    static readonly type = MarkTypeEnum.symbol;
    readonly type = MarkTypeEnum.symbol;
    protected _getDefaultStyle(): IMarkStyle<ISymbolMarkSpec>;
    protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any): any;
}
export declare const registerSymbolMark: () => void;
