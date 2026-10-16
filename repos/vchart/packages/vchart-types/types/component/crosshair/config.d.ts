import type { RenderMode } from '../../typings/spec';
export declare function getDefaultCrosshairTriggerEventByMode(mode: RenderMode): {
    click: string;
    hover: string;
    hoverOut: string;
    clickOut: string;
} | {
    click: string;
    hover: string[];
    hoverOut: string;
    clickOut: string;
};
export declare const enum LayoutType {
    ALL = 3,
    HORIZONTAL = 2,
    VERTICAL = 1
}
