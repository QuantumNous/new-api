const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');

module.exports = function getWebpackConfig({ minimize }) {
    return {
        mode: 'production',
        bail: true,
        devtool: 'source-map',
        entry: {
            index: ['./lib/es/index.js']
        },
        output: {
            filename: minimize ? 'umd/semi-illustrations.min.js' : 'umd/semi-illustrations.js',
            path: path.join(__dirname, 'dist'),
            library: 'SemiIllustrations',
            libraryTarget: 'umd'
        },
        optimization: {
            minimize: !!minimize,
            minimizer: [new TerserPlugin()]
        },
        performance: { maxEntrypointSize: 10485760, maxAssetSize: 5242880 },
        plugins: [
            new webpack.DefinePlugin({
                'process.env': { NODE_ENV: '"production"' }
            }),
            new CaseSensitivePathsPlugin(),
            new webpack.ids.HashedModuleIdsPlugin(),
        ],
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
        },
        externals: {
            react: {
                root: 'React',
                commonjs2: 'react',
                commonjs: 'react',
                amd: 'react'
            }
        }
    };
};