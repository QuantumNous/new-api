import { LazyResult } from 'postcss';
export interface StyleCompileOptions {
    source: string;
    filename: string;
    id: string;
    map?: any;
    scoped?: boolean;
    trim?: boolean;
    preprocessLang?: string;
    preprocessOptions?: any;
    postcssOptions?: any;
    postcssPlugins?: any[];
}
export interface AsyncStyleCompileOptions extends StyleCompileOptions {
    isAsync?: boolean;
}
export interface StyleCompileResults {
    code: string;
    map: any | void;
    rawResult: LazyResult | void;
    errors: string[];
}
export declare function compileStyle(options: StyleCompileOptions): StyleCompileResults;
export declare function compileStyleAsync(options: StyleCompileOptions): Promise<StyleCompileResults>;
export declare function doCompileStyle(options: AsyncStyleCompileOptions): StyleCompileResults;
