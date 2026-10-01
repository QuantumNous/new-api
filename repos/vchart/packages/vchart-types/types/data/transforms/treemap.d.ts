import { type TreemapNodeElement, type TreemapOptions } from '@visactor/vlayouts';
interface ITreemapLayoutOptions extends TreemapOptions {
    getViewBox: () => {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
    };
    nameField: string;
}
export declare const treemapLayout: (data: Array<Record<string, unknown>>, op: ITreemapLayoutOptions | (() => ITreemapLayoutOptions)) => TreemapNodeElement[];
export {};
