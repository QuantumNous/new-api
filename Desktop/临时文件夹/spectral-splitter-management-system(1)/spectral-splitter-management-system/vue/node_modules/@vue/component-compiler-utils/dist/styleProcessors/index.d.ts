export interface StylePreprocessor {
    render(source: string, map: any | null, options: any): StylePreprocessorResults;
}
export interface StylePreprocessorResults {
    code: string;
    map?: any;
    errors: Array<Error>;
}
export declare const processors: {
    [key: string]: StylePreprocessor;
};
