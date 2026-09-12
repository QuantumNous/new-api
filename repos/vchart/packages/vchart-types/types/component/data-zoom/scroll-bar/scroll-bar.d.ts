import type { IComponentOption } from '../../interface';
import { ComponentTypeEnum } from '../../interface/type';
import { DataFilterBaseComponent } from '../data-filter-base-component';
import type { ScrollBarAttributes } from '@visactor/vrender-components';
import { ScrollBar as ScrollBarComponent } from '@visactor/vrender-components';
import type { IGraphic } from '@visactor/vrender-core';
import type { IScrollBarSpec } from './interface';
import type { ILayoutType } from '../../../typings/layout';
export declare class ScrollBar<T extends IScrollBarSpec = IScrollBarSpec> extends DataFilterBaseComponent<T> {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static readonly builtInTheme: {
        scrollBar: import("./interface").IScrollBarTheme;
    };
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    layoutLevel: number;
    layoutType: ILayoutType;
    protected _component: ScrollBarComponent;
    constructor(spec: T, options: IComponentOption);
    protected _handleChange(start: number, end: number, updateComponent?: boolean): void;
    protected _handleDataCollectionChange(): void;
    protected _getComponentOnlySpecKeys(): Record<string, boolean>;
    protected _beforeLayoutEnd(): void;
    onLayoutEnd(): void;
    protected _updateScaleRange(): void;
    protected _updateComponentBounds(): void;
    protected _computeWidth(): number;
    protected _computeHeight(): number;
    private _getAttrs;
    protected _createOrUpdateComponent(): void;
    protected _getComponentAttrs(): Partial<ScrollBarAttributes>;
    protected _getNeedClearVRenderComponents(): IGraphic[];
}
export declare const registerScrollBar: () => void;
