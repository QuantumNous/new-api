import { CartesianLinearAxis } from './linear-axis';
import { ComponentTypeEnum } from '../../interface/type';
import { LinearAxisMixin } from '../mixin/linear-axis-mixin';
import { LogScale } from '@visactor/vscale';
import type { ICartesianLogAxisSpec } from './interface';
export interface CartesianLogAxis<T extends ICartesianLogAxisSpec = ICartesianLogAxisSpec> extends Pick<LinearAxisMixin, 'valueToPosition'>, CartesianLinearAxis<T> {
}
export declare class CartesianLogAxis<T extends ICartesianLogAxisSpec = ICartesianLogAxisSpec> extends CartesianLinearAxis<T> {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    static specKey: string;
    static readonly builtInTheme: {
        axis: import("../interface").IAxisCommonTheme;
        axisLinear: import("../interface").IAxisCommonTheme;
        axisX: import("./interface").ICartesianAxisCommonTheme;
        axisY: import("./interface").ICartesianAxisCommonTheme;
    };
    protected _zero: boolean;
    protected _scale: LogScale;
    protected _scales: LogScale[];
    protected initScales(): void;
    protected registerTicksTransform(): string;
    transformScaleDomain(): void;
}
export declare const registerCartesianLogAxis: () => void;
