import type { IPolygonMarkSpec } from '../../typings/visual';
import { BasePolygonMark } from './base-polygon';
import type { IMarkStyle, IPolygonMark } from '../interface';
import { MarkTypeEnum } from '../interface/type';
export declare class PolygonMark extends BasePolygonMark<IPolygonMarkSpec> implements IPolygonMark {
    static readonly type = MarkTypeEnum.polygon;
    readonly type = MarkTypeEnum.polygon;
    protected _getDefaultStyle(): IMarkStyle<IPolygonMarkSpec>;
}
export declare const registerPolygonMark: () => void;
