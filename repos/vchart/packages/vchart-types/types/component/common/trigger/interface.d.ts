export interface IZoomTrigger {
    parserZoomEvent: (e: any) => any;
    parserScrollEvent: (event: any) => any;
    clearZoom: () => void;
    clearScroll: () => void;
}
