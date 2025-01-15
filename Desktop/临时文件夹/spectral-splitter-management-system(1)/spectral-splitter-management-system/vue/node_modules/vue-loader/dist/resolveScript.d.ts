import type { LoaderContext } from 'webpack';
import type { SFCDescriptor, SFCScriptBlock } from 'vue/compiler-sfc';
import type { VueLoaderOptions } from 'src';
export declare const clientCache: WeakMap<SFCDescriptor, SFCScriptBlock | null>;
export declare const typeDepToSFCMap: Map<string, Set<string>>;
/**
 * inline template mode can only be enabled if:
 * - is production (separate compilation needed for HMR during dev)
 * - template has no pre-processor (separate loader chain required)
 * - template is not using src
 */
export declare function canInlineTemplate(descriptor: SFCDescriptor, isProd: boolean): boolean;
export declare function resolveScript(descriptor: SFCDescriptor, scopeId: string, options: VueLoaderOptions, loaderContext: LoaderContext<VueLoaderOptions>): SFCScriptBlock | null;
