import { LinearScale } from '@visactor/vscale';
import { ComponentTypeEnum } from '../../interface/type';
import { PolarAxis } from './axis';
import type { IPolarLinearAxisSpec } from './interface/spec';
import { LinearAxisMixin } from '../mixin/linear-axis-mixin';
export interface PolarLinearAxis<T extends IPolarLinearAxisSpec = IPolarLinearAxisSpec> extends Pick<LinearAxisMixin, 'setExtraAttrFromSpec' | 'transformScaleDomain' | 'valueToPosition' | 'computeLinearDomain' | 'setScaleNice' | 'setExtendDomain'>, PolarAxis<T> {
}
export declare class PolarLinearAxis<T extends IPolarLinearAxisSpec = IPolarLinearAxisSpec> extends PolarAxis<T> {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    static specKey: string;
    static readonly builtInTheme: {
        axis: import("../interface").IAxisCommonTheme;
        axisLinear: import("../interface").IAxisCommonTheme;
        axisAngle: import("./interface").IPolarAxisCommonTheme;
        axisRadius: import("./interface").IPolarAxisCommonTheme;
    };
    protected _zero: boolean;
    protected _nice: boolean;
    protected _extend: {
        [key: string]: number;
    };
    protected _scale: LinearScale;
    protected _groupScales: LinearScale[];
    setAttrFromSpec(): void;
    protected initScales(): void;
    protected computeDomain(data: {
        min: number;
        max: number;
        values: any[];
    }[]): number[];
    protected axisHelper(): any;
    protected registerTicksTransform(): string;
}
export declare const registerPolarLinearAxis: () => void;
