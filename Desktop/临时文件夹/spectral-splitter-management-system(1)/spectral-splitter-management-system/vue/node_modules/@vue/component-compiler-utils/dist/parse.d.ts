import { RawSourceMap, VueTemplateCompiler, VueTemplateCompilerParseOptions } from './types';
export interface ParseOptions {
    source: string;
    filename?: string;
    compiler: VueTemplateCompiler;
    compilerParseOptions?: VueTemplateCompilerParseOptions;
    sourceRoot?: string;
    needMap?: boolean;
}
export interface SFCCustomBlock {
    type: string;
    content: string;
    attrs: {
        [key: string]: string | true;
    };
    start: number;
    end: number;
    map?: RawSourceMap;
}
export interface SFCBlock extends SFCCustomBlock {
    lang?: string;
    src?: string;
    scoped?: boolean;
    module?: string | boolean;
}
export interface SFCDescriptor {
    template: SFCBlock | null;
    script: SFCBlock | null;
    styles: SFCBlock[];
    customBlocks: SFCCustomBlock[];
}
export declare function parse(options: ParseOptions): SFCDescriptor;
