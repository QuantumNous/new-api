import type { Compiler, LoaderContext } from 'webpack';
import type { SFCDescriptor, CompilerOptions } from 'vue/compiler-sfc';
import type { VueLoaderOptions } from '.';
export declare function needHMR(vueLoaderOptions: VueLoaderOptions, compilerOptions: Compiler['options']): boolean;
export declare function resolveTemplateTSOptions(descriptor: SFCDescriptor, options: VueLoaderOptions): CompilerOptions | null;
export declare function getOptions(loaderContext: LoaderContext<VueLoaderOptions>): any;
export declare function stringifyRequest(loaderContext: LoaderContext<VueLoaderOptions>, request: string): string;
export declare function genMatchResource(context: LoaderContext<VueLoaderOptions>, resourcePath: string, resourceQuery?: string, lang?: string): string;
export declare const testWebpack5: (compiler?: Compiler | undefined) => boolean;
