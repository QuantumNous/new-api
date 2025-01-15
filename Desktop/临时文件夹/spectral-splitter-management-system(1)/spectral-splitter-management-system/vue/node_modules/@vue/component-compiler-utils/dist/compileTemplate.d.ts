import { VueTemplateCompiler, VueTemplateCompilerOptions, ErrorWithRange } from './types';
import { AssetURLOptions, TransformAssetUrlsOptions } from './templateCompilerModules/assetUrl';
export interface TemplateCompileOptions {
    source: string;
    filename: string;
    compiler: VueTemplateCompiler;
    compilerOptions?: VueTemplateCompilerOptions;
    transformAssetUrls?: AssetURLOptions | boolean;
    transformAssetUrlsOptions?: TransformAssetUrlsOptions;
    preprocessLang?: string;
    preprocessOptions?: any;
    transpileOptions?: any;
    isProduction?: boolean;
    isFunctional?: boolean;
    optimizeSSR?: boolean;
    prettify?: boolean;
}
export interface TemplateCompileResult {
    ast: Object | undefined;
    code: string;
    source: string;
    tips: (string | ErrorWithRange)[];
    errors: (string | ErrorWithRange)[];
}
export declare function compileTemplate(options: TemplateCompileOptions): TemplateCompileResult;
