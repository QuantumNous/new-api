export type CachedWordMeasure = {
    sprite: number[];
    bounds: {
        dTop: number;
        dBottom: number;
        dLeft: number;
        dRight: number;
    };
    wordSize: [number, number];
};
export declare class WordMeasureCache {
    private _map;
    private _maxSize;
    constructor(maxSize?: number);
    get(key: string): CachedWordMeasure;
    set(key: string, value: CachedWordMeasure): void;
    clear(): void;
    size(): number;
}
