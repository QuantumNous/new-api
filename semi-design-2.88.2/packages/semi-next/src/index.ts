// import { NextConfig } from 'next';
import SemiWebpackPlugin from '@douyinfe/semi-webpack-plugin';

export interface SemiNextOptions {
    omitCss?: boolean
}

export default function(options: SemiNextOptions = {}) {
    return (nextConfig: any = {}) => {
        const actualConfig: any = {
            ...nextConfig,
            webpack(config: any, { isServer, webpack, ...rest }: any) {
                config.plugins.push(new SemiWebpackPlugin({
                    omitCss: options.omitCss === undefined ? true : options.omitCss,
                    webpackContext: {
                        NormalModule: webpack.NormalModule
                    }
                }));
                if (isServer) {
                    if (
                        Array.isArray(config.externals) &&
                        typeof config.externals[0] === 'function'
                    ) {
                        const [ origin ] = config.externals;
                        // Because css is referenced in SemiUI and SemiIcons, 
                        // an error will be reported at the ssg or ssr stage because the code will be executed in Node.
                        config.externals = [
                            (context: any) => {
                                return new Promise((resolve) => {
                                    if (
                                        /@douyinfe\/semi-(ui|icons)/.test(context.request)
                                    ) {
                                        resolve(undefined);
                                    } else {
                                        resolve(origin(context));
                                    }
                                });
                            }
                        ];
                    }
                }
                if (typeof nextConfig.webpack === 'function') {
                    return nextConfig.webpack(config, { isServer, webpack, ...rest });
                }
                return config;
            }
        };
        return actualConfig;
    };
}
