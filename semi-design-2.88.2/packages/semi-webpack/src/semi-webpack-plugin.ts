import path from 'path';
import { Compiler as LegacyCompiler } from 'webpack';
import { Compiler } from 'webpack';
import { transformPath } from './utils';

export interface WebpackContext {
    NormalModule?: any
}

export interface ExtractCssOptions {
    loader: string;
    loaderOptions?: any
}
export interface SemiWebpackPluginOptions {
    theme?: string | SemiThemeOptions;
    cssLayer?: boolean;
    prefixCls?: string;
    variables?: {[key: string]: string | number};
    include?: string;
    omitCss?: boolean;
    /** @deprecated SemiWebpackPlugin will get webpack context from compiler instance. */
    webpackContext?: WebpackContext;
    extractCssOptions?: ExtractCssOptions;
    overrideStylesheetLoaders?: (loaders: any[]) => any[];
    webComponentPath?: boolean | RegExp
}

export interface SemiThemeOptions {
    name?: string
}

export default class SemiWebpackPlugin {

    options: SemiWebpackPluginOptions;
    constructor(options: SemiWebpackPluginOptions) {
        this.options = options;
    }

    apply(compiler: Compiler | LegacyCompiler) {
        let NormalModule = this.options.webpackContext?.NormalModule;
        if (!NormalModule && 'webpack' in compiler) NormalModule = compiler.webpack.NormalModule;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (!NormalModule) NormalModule = require('webpack/lib/NormalModule');

        compiler.hooks.compilation.tap('SemiPlugin', (compilation: any) => {
            if (NormalModule.getCompilationHooks) {
                NormalModule.getCompilationHooks(compilation).loader.tap('SemiPlugin', (context: any, module: any) => {
                    if (this.options.omitCss) {
                        this.omitCss(module);
                        if (!this.options.webComponentPath) {
                            return;
                        }
                    }
                    this.customTheme(module);
                    if (this.options.prefixCls) {
                        this.customPrefix(module, this.options.prefixCls);
                    }
                    if (this.options.webComponentPath) {
                        this.webComponentAdapter(module);
                    }
                });
            } else {
                compilation.hooks.normalModuleLoader.tap('SemiPlugin', (context: any, module: any) => {
                    if (this.options.omitCss) {
                        this.omitCss(module);
                        if (!this.options.webComponentPath) {
                            return;
                        }
                    }
                    this.customTheme(module);
                    if (this.options.prefixCls) {
                        this.customPrefix(module, this.options.prefixCls);
                    }
                    if (this.options.webComponentPath) {
                        this.webComponentAdapter(module);
                    }
                });
            }
        });
    }

    webComponentAdapter(module: any) {
        const compatiblePath = transformPath(module.resource);
        const reg = this.options.webComponentPath instanceof RegExp ? this.options.webComponentPath : /src\/([^/]+\/)*[^/]+\.(ts|tsx|js|jsx)$/;
        if (reg.test(compatiblePath)) {
            module.loaders = module.loaders || [];
            module.loaders.push({
                loader: path.join(__dirname, 'semi-web-component-loader')
            });
        }
    }

    omitCss(module: any) {
        const compatiblePath = transformPath(module.resource);
        if (/@douyinfe\/semi-(ui|icons)\/lib\/.+\.js$/.test(compatiblePath)) {
            module.loaders = module.loaders || [];
            module.loaders.push({
                loader: path.join(__dirname, 'semi-omit-css-loader')
            });
        }
    }

    customTheme(module: any) {
        const compatiblePath = transformPath(module.resource);
        if (/@douyinfe\/semi-(ui|icons)\/lib\/.+\.js$/.test(compatiblePath)) {
            module.loaders = module.loaders || [];
            module.loaders.push({
                loader: path.join(__dirname, 'semi-source-suffix-loader')
            });
        }
        if (/@douyinfe\/semi-(ui|icons|foundation)\/lib\/.+\.scss$/.test(compatiblePath)) {
            const scssLoader = require.resolve('sass-loader');
            const cssLoader = require.resolve('css-loader');
            const styleLoader = require.resolve('style-loader');
            const extraCssLoader = path.join(__dirname, 'semi-extract-css-content-loader');
            const rawLoader = require.resolve('raw-loader');
            const semiSemiLoaderOptions = typeof this.options.theme === 'object' ? { ...this.options.theme, cssLayer: this.options.cssLayer } : {
                name: this.options.theme,
                cssLayer: this.options.cssLayer
            };
            if (!this.hasSemiThemeLoader(module.loaders)) {
                const lastLoader = this.options.extractCssOptions ? {
                    loader: this.options.extractCssOptions.loader,
                    options: this.options.extractCssOptions.loaderOptions || {}
                } : {
                    loader: styleLoader
                };
                const getRawCssLoaders = [
                    {
                        loader: rawLoader
                    },
                    {
                        loader: extraCssLoader
                    }
                ];
                const commonLoaderList: any[] = [
                    {
                        loader: cssLoader,
                        options: {
                            sourceMap: false,
                        }
                    }, {
                        loader: scssLoader,
                        options: {
                            sassOptions: {
                                silenceDeprecations: ['import', 'legacy-js-api', 'global-builtin'],
                            },
                        }
                    },
                    {
                        loader: path.join(__dirname, 'semi-theme-loader'),
                        options: {
                            ...semiSemiLoaderOptions,
                            prefixCls: this.options.prefixCls,
                            variables: this.convertMapToString(this.options.variables || {}),
                            include: this.options.include
                        }
                    }
                ];
                let loaderList = commonLoaderList;
                if (this.options.webComponentPath) {
                    loaderList = [
                        ...getRawCssLoaders,
                        ...commonLoaderList,
                    ];
                } else {
                    loaderList = [
                        lastLoader,
                        ...commonLoaderList,
                    ];
                }
                module.loaders = this.options.overrideStylesheetLoaders?.(loaderList) ?? loaderList;
            }
        }
    }

    customPrefix(module: any, prefix: string) {
        const compatiblePath = transformPath(module.resource);
        if (/@douyinfe\/semi-[^/]+\/.+env\.js$/.test(compatiblePath)) {
            module.loaders = module.loaders || [];
            module.loaders.push({
                loader: path.join(__dirname, 'semi-prefix-loader'),
                options: {
                    replacers: {
                        BASE_CLASS_PREFIX: prefix
                    }
                }
            });
        }
    }

    hasSemiThemeLoader(loaders: any[]) {
        return (loaders || []).some((loader) => /semi-theme-loader/.test(loader.loader));
    }

    convertMapToString(map: {[key: string]: string | number}): string {
        return Object.keys(map).reduce(function (prev, curr) {
            return prev + `${curr}: ${map[curr]};\n`;
        }, '');
    }
}

