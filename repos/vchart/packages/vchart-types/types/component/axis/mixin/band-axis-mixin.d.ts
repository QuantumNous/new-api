import type { BandScale } from '@visactor/vscale';
import type { Dict } from '@visactor/vutils';
import type { IOrientType, IPolarOrientType, StringOrNumber } from '../../../typings';
import type { IEvent } from '../../../event/interface';
import type { IAxisLocationCfg } from '../interface';
import { CompilableData } from '../../../compile/data/compilable-data';
export interface BandAxisMixin {
    _orient: IOrientType | IPolarOrientType;
    _option: any;
    _scale: BandScale;
    _scales: BandScale[];
    _spec: any;
    _tick: any;
    _tickData: CompilableData[];
    _defaultBandPosition: number;
    _defaultBandInnerPadding: number;
    _defaultBandOuterPadding: number;
    event: IEvent;
    isSeriesDataEnable: () => boolean;
    collectData: (depth: number, rawData?: boolean) => {
        min: number;
        max: number;
        values: any[];
    }[];
    computeDomain: (data: {
        min: number;
        max: number;
        values: any[];
    }[]) => StringOrNumber[];
    transformScaleDomain: () => void;
    _initTickDataSet: (options: any, index?: number) => any;
    _tickTransformOption: () => any;
    _forceLayout: () => void;
    _getNormalizedValue: (values: any[], length: number) => number;
    _onTickDataChange: (compilableData: CompilableData) => void;
    registerTicksTransform: () => string;
    _refreshVisibilityByData: () => boolean;
}
export declare class BandAxisMixin {
    private _tickDataMap;
    protected _initData(): void;
    protected _updateData(): void;
    protected _rawDomainIndex: {
        [key: string | number | symbol]: number;
    }[];
    protected _rawDomain: StringOrNumber[][];
    getRawDomain(): StringOrNumber[][];
    dataToPosition(values: any[], cfg?: IAxisLocationCfg): number;
    valueToPosition(value: any): number;
    updateGroupScaleRange(): void;
    getPosition(values: any[]): {
        position: number;
        bandScale: BandScale;
    };
    calcScales(DEFAULT_BAND_INNER_PADDING: number, DEFAULT_BAND_OUTER_PADDING: number): void;
    computeBandDomain(data: {
        min: number;
        max: number;
        values: any[];
    }[]): StringOrNumber[];
    protected updateScaleDomain(): void;
    protected getLabelItems(length: number): Dict<any>[][];
    protected _updateRawDomain(): void;
    protected _clearRawDomain(): void;
}
