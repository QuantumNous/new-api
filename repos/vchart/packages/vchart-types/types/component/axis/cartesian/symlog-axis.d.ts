import { CartesianLinearAxis } from './linear-axis';
import { ComponentTypeEnum } from '../../interface/type';
import { LinearAxisMixin } from '../mixin/linear-axis-mixin';
import { SymlogScale } from '@visactor/vscale';
import type { ICartesianSymlogAxisSpec } from './interface';
export interface CartesianSymlogAxis<T extends ICartesianSymlogAxisSpec = ICartesianSymlogAxisSpec> extends Pick<LinearAxisMixin, 'valueToPosition'>, CartesianLinearAxis<T> {
}
export declare class CartesianSymlogAxis<T extends ICartesianSymlogAxisSpec = ICartesianSymlogAxisSpec> extends CartesianLinearAxis<T> {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    static specKey: string;
    static readonly builtInTheme: {
        axis: import("..").IAxisCommonTheme;
        axisLinear: import("..").IAxisCommonTheme;
        axisX: import("./interface").ICartesianAxisCommonTheme;
        axisY: import("./interface").ICartesianAxisCommonTheme;
    };
    protected _zero: boolean;
    protected _scale: SymlogScale;
    protected _scales: SymlogScale[];
    protected initScales(): void;
    protected registerTicksTransform(): string;
    transformScaleDomain(): void;
}
export declare const registerCartesianSymlogAxis: () => void;
