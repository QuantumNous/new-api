import { BaseComponent } from '../base/base-component';
import { ComponentTypeEnum } from '../interface/type';
import type { EnableMarkType, ICustomMarkGroupSpec, ICustomMarkSpec, ILayoutRect } from '../../typings';
import type { IModelMarkAttributeContext } from '../../compile/mark/interface';
export declare class CustomMark extends BaseComponent<ICustomMarkSpec<EnableMarkType>> {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    static specKey: string;
    specKey: string;
    layoutType: 'none';
    layoutZIndex: number;
    layoutLevel: number;
    protected _spec: ICustomMarkSpec<Exclude<EnableMarkType, 'group'>> | ICustomMarkGroupSpec;
    created(): void;
    protected _markAttributeContext: IModelMarkAttributeContext;
    getMarkAttributeContext(): IModelMarkAttributeContext;
    protected _buildMarkAttributeContext(): void;
    protected initMarks(): void;
    private _createExtensionMark;
    initEvent(): void;
    _compareSpec(spec: ICustomMarkSpec<EnableMarkType>, prevSpec: ICustomMarkSpec<EnableMarkType>): import("../..").IUpdateSpecResult;
    protected _isComponentOnlySpecChange(spec: ICustomMarkSpec<EnableMarkType>, prevSpec: ICustomMarkSpec<EnableMarkType>): boolean;
    reInit(spec?: ICustomMarkSpec<EnableMarkType>): void;
    private _updateMarkStyleWithSpec;
    private _getMarkAttributeContext;
    private _getLayoutRect;
    getBoundsInRect(rect: ILayoutRect): {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    getVRenderComponents(): any[];
}
export declare const registerCustomMark: () => void;
