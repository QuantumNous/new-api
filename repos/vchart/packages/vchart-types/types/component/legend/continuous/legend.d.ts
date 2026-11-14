import type { Maybe } from '@visactor/vutils';
import { DataView } from '@visactor/vdataset';
import type { IModelInitOption, IModelSpecInfo } from '../../../model/interface';
import type { IComponentOption } from '../../interface';
import { ComponentTypeEnum } from '../../interface/type';
import type { IColorLegendSpec, ISizeLegendSpec } from './interface';
import { BaseLegend } from '../base-legend';
import type { ILayoutRect } from '../../../typings/layout';
export declare class ContinuousLegend<T extends IColorLegendSpec | ISizeLegendSpec = IColorLegendSpec | ISizeLegendSpec> extends BaseLegend<T> {
    static specKey: string;
    static readonly builtInTheme: {
        colorLegend: import("./interface").IColorLegendTheme;
        sizeLegend: import("./interface").ISizeLegendTheme;
    };
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    private _field;
    private _legendType;
    static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]>;
    constructor(spec: T, options: IComponentOption);
    setAttrFromSpec(): void;
    init(option: IModelInitOption): void;
    private _getScaleInGlobal;
    protected _initLegendData(): DataView;
    protected _initSelectedData(): void;
    private _addDefaultTitleText;
    protected _getLegendAttributes(rect: ILayoutRect): any;
    protected _getLegendConstructor(): any;
    protected _initEvent(): void;
}
export declare const registerContinuousLegend: () => void;
