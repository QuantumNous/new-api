import type { LinearScale } from '@visactor/vscale';
import type { IAxisLocationCfg, ILinearAxisBreakSpec, ITick } from '../interface';
import type { IEvent } from '../../../event/interface';
import type { IOrientType } from '../../../typings/space';
import type { IComponentOption } from '../../interface/common';
import type { StringOrNumber } from '../../../typings';
export declare const e10: number;
export declare const e5: number;
export declare const e2: number;
export interface LinearAxisMixin {
    _scale: LinearScale;
    _scales: LinearScale[];
    _spec: any;
    _nice: boolean;
    _zero: boolean;
    _domain: {
        min?: number;
        max?: number;
    };
    _domainAfterSpec: number[];
    _softMinValue?: number;
    _softMaxValue?: number;
    _expand?: {
        max?: number;
        min?: number;
    };
    _tick: ITick | undefined;
    _lastNiceAxisLength?: number;
    isSeriesDataEnable: any;
    computeDomain: any;
    collectData: (depth?: number, rawData?: boolean) => {
        min: number;
        max: number;
        values: any[];
    }[];
    _break: {
        domain: [number, number][];
        scope: [number, number][];
        breakDomains: [number, number][];
        breaks: ILinearAxisBreakSpec[];
    };
    event: IEvent;
    _orient: IOrientType;
    _option: IComponentOption;
    niceLabelFormatter: (value: StringOrNumber) => StringOrNumber;
    _refreshVisibilityByData: () => boolean;
}
export declare class LinearAxisMixin {
    protected _extend: {
        [key: string]: number;
    };
    protected _rawDomain: StringOrNumber[];
    getRawDomain(): StringOrNumber[];
    niceLabelFormatter: (value: StringOrNumber) => StringOrNumber;
    setExtraAttrFromSpec(): void;
    transformScaleDomain(): void;
    setLinearScaleNice(): false | LinearScale;
    setLogScaleNice(): false | LinearScale;
    setScaleNice(): false | LinearScale;
    reTransformDomainByLayout(): void;
    dataToPosition(values: any[], cfg?: IAxisLocationCfg): number;
    valueToPosition(value: any): number;
    computeLinearDomain(data: {
        min: number;
        max: number;
        values: any[];
    }[]): number[];
    protected expandDomain(domain: number[]): void;
    protected niceDomain(domain: number[]): number[];
    protected includeZero(domain: number[]): void;
    setExtendDomain(key: string, value: number | undefined): void;
    protected extendDomain(domain: number[]): void;
    getDomainSpec(): {
        min?: number;
        max?: number;
    };
    protected setDomainMinMax(domain: number[]): void;
    protected setSoftDomainMinMax(domain: number[]): void;
    setZero(zero: boolean): void;
    protected updateScaleDomain(): void;
    protected updateScaleDomainByModel(domain?: number[]): void;
    getDomainAfterSpec(): number[];
    protected _updateNiceLabelFormatter(domain: number[]): void;
    protected _updateRawDomain(): void;
    protected _clearRawDomain(): void;
}
