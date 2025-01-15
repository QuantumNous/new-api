/// <reference types="node" />
import type { LoaderContext } from 'webpack';
import type { SFCDescriptor } from 'vue/compiler-sfc';
import type { ParsedUrlQuery } from 'querystring';
import type { VueLoaderOptions } from 'src';
export declare function selectBlock(descriptor: SFCDescriptor, scopeId: string, options: VueLoaderOptions, loaderContext: LoaderContext<VueLoaderOptions>, query: ParsedUrlQuery, appendExtension: boolean): void;
