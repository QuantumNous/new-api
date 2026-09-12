import { BaseComponent } from '../base/base-component';
import { ComponentTypeEnum } from '../interface/type';
import { Brush as BrushComponent } from '@visactor/vrender-components';
import type { Maybe } from '@visactor/vutils';
import type { IModelSpecInfo } from '../../model/interface';
import type { IRegion } from '../../region/interface';
import type { IGraphic, IPolygon } from '@visactor/vrender-core';
import type { ISeries } from '../../series/interface';
import type { IMark, IMarkGraphic } from '../../mark/interface';
import type { BrushInteractiveRangeAttr, IBrush, IBrushSpec } from './interface';
export declare class Brush<T extends IBrushSpec = IBrushSpec> extends BaseComponent<T> implements IBrush {
    layoutType: 'none';
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static readonly builtInTheme: {
        brush: import("./interface").IBrushTheme;
    };
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    protected _brushComponents: BrushComponent[];
    protected _relativeRegions: IRegion[];
    protected _linkedSeries: ISeries[];
    protected _operateMask: IPolygon;
    private _itemMap;
    private _linkedItemMap;
    protected _inBrushElementsMap: {
        [brushName: string]: {
            [elementKey: string]: IMarkGraphic;
        };
    };
    protected _outOfBrushElementsMap: {
        [elementKey: string]: IMarkGraphic;
    };
    protected _linkedInBrushElementsMap: {
        [brushName: string]: {
            [elementKey: string]: IMarkGraphic;
        };
    };
    protected _linkedOutOfBrushElementsMap: {
        [elementKey: string]: IMarkGraphic;
    };
    private _cacheInteractiveRangeAttrs;
    private _releatedAxes;
    private _regionAxisMap;
    private _axisDataZoomMap;
    private _zoomRecord;
    static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]>;
    init(): void;
    reInit(spec?: T): void;
    private _initNeedOperatedItem;
    created(): void;
    protected _bindRegions(): void;
    protected _bindLinkedSeries(): void;
    private _initRegionAxisMap;
    private _initAxisDataZoomMap;
    protected initEvent(): void;
    _compareSpec(spec: T, prevSpec: T): import("../../model/interface").IUpdateSpecResult;
    protected _isComponentOnlySpecChange(spec: T, prevSpec: T): boolean;
    onLayoutEnd(): void;
    protected _updateBrushComponent(region: IRegion, componentIndex: number): void;
    protected _shouldEnableInteractive(): boolean;
    protected _createBrushComponent(region: IRegion, componentIndex: number): void;
    protected _getBrushInteractiveAttr(region: IRegion): BrushInteractiveRangeAttr;
    private _transformBrushedMarkAttr;
    private _handleBrushChange;
    protected _extendDataInBrush(elementsMap: {
        [brushName: string]: {
            [elementKey: string]: IMarkGraphic;
        };
    }): {
        [x: string]: any;
    }[];
    protected _extendDatumOutOfBrush(elementsMap: {
        [elementKey: string]: IMarkGraphic;
    }): import("../..").Datum[];
    private _emitEvent;
    private _setBrushState;
    private _reconfigItem;
    private _reconfigLinkedItem;
    private _isBrushContainItem;
    protected _initItemMap(itemMap: Record<string, IMark[]>, elementMap: Record<string, IMarkGraphic>, stateName: string): void;
    protected _initMarkBrushState(componentIndex: number, stateName: string): void;
    private _setRegionMarkPickable;
    private _stateClamp;
    private _setAxisAndDataZoom;
    protected _getNeedClearVRenderComponents(): IGraphic[];
    clearGraphic(): void;
    clear(): void;
    clearBrushStateAndMask(): void;
}
export declare const registerBrush: () => void;
