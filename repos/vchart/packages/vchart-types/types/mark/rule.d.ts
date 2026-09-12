import type { IRuleMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkGraphic, IMarkStyle, IRuleMark } from './interface';
import { MarkTypeEnum } from './interface/type';
import type { IGraphic, ILineGraphicAttribute } from '@visactor/vrender-core';
export declare class RuleMark extends BaseMark<IRuleMarkSpec> implements IRuleMark {
    static readonly type = MarkTypeEnum.rule;
    readonly type = MarkTypeEnum.rule;
    protected _getDefaultStyle(): IMarkStyle<IRuleMarkSpec>;
    protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any): any;
    protected _createGraphic(attrs?: ILineGraphicAttribute): IGraphic;
}
export declare const registerRuleMark: () => void;
