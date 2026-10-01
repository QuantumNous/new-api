import type { RenderMode } from '../../../typings/spec';
import { DeskTopTrigger } from './desktop';
import { MobileTrigger } from './mobile';
export declare function getDefaultTriggerEventByMode(mode: RenderMode): {
    start: string;
    move: string;
    end: string[];
    zoom: string;
    zoomEnd: string;
    scroll: string;
    trigger: typeof DeskTopTrigger;
    scrollEnd?: undefined;
} | {
    start: string;
    move: string;
    end: string[];
    zoom: string;
    zoomEnd: string;
    scroll: string;
    scrollEnd: string;
    trigger: typeof MobileTrigger;
};
