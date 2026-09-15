import type { RenderMode } from '../typings/spec/common';
import type { IHoverSpec, ISelectSpec } from './interface/spec';
export declare function getDefaultInteractionConfigByMode(mode: RenderMode): {
    hover: {
        enable: boolean;
        trigger: string;
        triggerOff: string;
    };
    select: {
        enable: boolean;
        trigger: string;
    };
} | {
    hover: {
        enable: boolean;
        trigger: string[];
        triggerOff: string;
    };
    select: {
        enable: boolean;
        trigger: string;
    };
};
export declare const parseHoverSelect: (mode: RenderMode, hoverSpec: IHoverSpec, selectSpec: ISelectSpec) => {
    select: ISelectSpec;
    hover: {
        enable: boolean;
        trigger: string;
        triggerOff: string;
    } | {
        enable: boolean;
        trigger: string[];
        triggerOff: string;
    };
};
