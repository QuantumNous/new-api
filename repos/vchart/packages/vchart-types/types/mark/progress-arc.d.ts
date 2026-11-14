import type { StateValueType } from '../typings/spec';
import type { ConvertToMarkStyleSpec, IProgressArcMarkSpec } from '../typings/visual';
import type { IMarkRaw, IMarkStateStyle, IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface/type';
import { BaseArcMark } from './arc';
export type IProgressArcMark = IMarkRaw<IProgressArcMarkSpec>;
export declare class ProgressArcMark extends BaseArcMark<IProgressArcMarkSpec> implements IProgressArcMark {
    static readonly type = MarkTypeEnum.arc;
    static readonly constructorType = MarkTypeEnum.progressArc;
    protected _cacheStateStyle: IMarkStateStyle<IProgressArcMarkSpec>;
    protected _getDefaultStyle(): IMarkStyle<IProgressArcMarkSpec>;
    protected _filterStyle(style: Partial<IMarkStyle<IProgressArcMarkSpec>>, state: StateValueType, level: number, stateStyle?: IMarkStateStyle<IProgressArcMarkSpec>): Partial<ConvertToMarkStyleSpec<IProgressArcMarkSpec>> | Partial<IMarkStyle<IProgressArcMarkSpec>>;
}
export declare const registerProgressArcMark: () => void;
