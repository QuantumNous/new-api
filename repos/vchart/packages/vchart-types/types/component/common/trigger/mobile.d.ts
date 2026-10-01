import type { IZoomTrigger } from './interface';
export declare class MobileTrigger implements IZoomTrigger {
    private _lastScale;
    clearZoom(): void;
    parserZoomEvent(event: any): any;
    parserScrollEvent(event: any): any;
    clearScroll(): void;
    clearDrag(): void;
}
