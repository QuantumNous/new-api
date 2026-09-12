import type { IGraphic } from '@visactor/vrender-core';
import type { IRadarAnimationParams, RadarAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
import type { Datum } from '../../typings/common';
export declare const radarFadeAnimation: (animationType: 'in' | 'out') => {
    type: string;
};
export declare const radarGrowAnimation: (params: IRadarAnimationParams, animationType: 'in' | 'out') => {
    type: string;
    options: () => {
        center: import("../..").IPoint;
    };
};
export declare function radarPresetAnimation(params: IRadarAnimationParams, preset: RadarAppearPreset, animationType: 'in' | 'out'): {
    type: string;
};
export declare const radarSymbolMoveAnimation: (params: IRadarAnimationParams, animationType: 'in' | 'out') => {
    channel: {
        x: {
            from: () => number;
            to: (datum: Datum, element: IGraphic) => any;
        };
        y: {
            from: () => number;
            to: (datum: Datum, element: IGraphic) => any;
        };
    };
} | {
    channel: {
        x: {
            from: (datum: Datum, element: IGraphic) => any;
            to: () => number;
        };
        y: {
            from: (datum: Datum, element: IGraphic) => any;
            to: () => number;
        };
    };
};
export declare function radarSymbolPresetAnimation(params: IRadarAnimationParams, preset: RadarAppearPreset, animationType: 'in' | 'out'): {
    type: string;
} | {
    channel: {
        x: {
            from: () => number;
            to: (datum: Datum, element: IGraphic<Partial<import("@visactor/vrender-core").IGraphicAttribute>>) => any;
        };
        y: {
            from: () => number;
            to: (datum: Datum, element: IGraphic<Partial<import("@visactor/vrender-core").IGraphicAttribute>>) => any;
        };
    };
} | {
    channel: {
        x: {
            from: (datum: Datum, element: IGraphic<Partial<import("@visactor/vrender-core").IGraphicAttribute>>) => any;
            to: () => number;
        };
        y: {
            from: (datum: Datum, element: IGraphic<Partial<import("@visactor/vrender-core").IGraphicAttribute>>) => any;
            to: () => number;
        };
    };
};
export declare const radarGroupClipAnimation: (params: IRadarAnimationParams, animationType: 'in' | 'out') => IAnimationTypeConfig;
export declare const registerRadarAnimation: () => void;
