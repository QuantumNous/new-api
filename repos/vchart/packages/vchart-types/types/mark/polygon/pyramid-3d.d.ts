import type { IPyramid3dMarkSpec } from '../../typings/visual';
import { MarkTypeEnum } from '../interface/type';
import { BasePolygonMark } from './base-polygon';
import type { IPyramid3dMark } from '../interface/mark';
export declare class Pyramid3dMark extends BasePolygonMark<IPyramid3dMarkSpec> implements IPyramid3dMark {
    static readonly type = MarkTypeEnum.pyramid3d;
    readonly type = MarkTypeEnum.pyramid3d;
}
export declare const registerPyramid3dMark: () => void;
