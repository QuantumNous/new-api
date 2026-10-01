import { BaseComponent } from '../base/base-component';
import type { IComponentOption } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
import type { ILabelSpec } from './interface';
import type { IComponentMark } from '../../mark/interface/mark';
import type { ICompilableMark } from '../../compile/mark/interface';
import type { IMark } from '../../mark/interface/common';
export declare abstract class BaseLabelComponent<T = any> extends BaseComponent<T> {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    layoutType: 'none';
    layoutZIndex: number;
    constructor(spec: T, options: IComponentOption);
    protected _interactiveConfig(labelSpec: ILabelSpec): {
        hover: boolean;
        select: boolean;
        state: {
            hover?: Partial<import("../../core").IComposedTextMarkSpec>;
            hover_reverse?: Partial<import("../../core").IComposedTextMarkSpec>;
            selected?: Partial<import("../../core").IComposedTextMarkSpec>;
            selected_reverse?: Partial<import("../../core").IComposedTextMarkSpec>;
        };
    };
    _compareSpec(spec: T, prevSpec: T): import("../../core").IUpdateSpecResult;
    _getDataLabelType(baseMark: ICompilableMark, type?: string): string;
    _setTransformOfComponent(labelComponent: IComponentMark, baseMark: IMark | IMark[]): void;
    getVRenderComponents(): any[];
    clear(): void;
}
