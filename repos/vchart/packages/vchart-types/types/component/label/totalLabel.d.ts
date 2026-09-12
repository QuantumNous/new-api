import type { IComponentOption } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
import type { MarkType } from '../../mark/interface';
import type { ISeries } from '../../series/interface';
import { BaseLabelComponent } from './base-label';
import type { ITotalLabelSpec, ITotalLabelTheme } from './interface';
import type { IModelInitOption } from '../../model/interface';
export declare class TotalLabel extends BaseLabelComponent {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    layoutZIndex: number;
    private _textMark?;
    private _baseMark?;
    series: ISeries;
    protected _theme: ITotalLabelTheme;
    static createComponent(spec: ITotalLabelSpec, options: IComponentOption): TotalLabel[];
    init(option: IModelInitOption): void;
    protected _initTextMark(): void;
    _initTextMarkStyle(): void;
    protected _initLabelComponent(): void;
    updateLayoutAttribute(): void;
    compileMarks(): void;
    getVRenderComponents(): any[];
}
export declare function totalLabelPosition(series: ISeries, type: MarkType): string;
export declare const registerTotalLabel: () => void;
