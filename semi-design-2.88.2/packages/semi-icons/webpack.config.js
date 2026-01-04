const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
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
            filename: minimize ? 'umd/semi-icons.min.js' : 'umd/semi-icons.js',
            path: path.join(__dirname, 'dist'),
            library: 'SemiIcons',
            libraryTarget: 'umd'
        },
        module: {
            rules: [
                { 
                    test: /\.css$/, 
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader
                        },
                        {
                            loader: 'css-loader'
                        }
                    ] 
                },
            ]
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
            new MiniCssExtractPlugin({
                // Options similar to the same options in webpackOptions.output
                // both options are optional
                filename: minimize ? 'css/semi-icons.min.css' : 'css/semi-icons.css',
            })
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