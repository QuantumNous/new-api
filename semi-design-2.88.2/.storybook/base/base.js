
const path = require('path');
const _ = require('lodash');
const chalk = require('chalk').default;
const utils = require('./utils');
const fs = require('fs');
let AnalyzePlugin = null
if(process.env.__ENABLE_ANALYZE__ === 'true') {
    AnalyzePlugin = require("@ies/semi-page-analyze-inject/src/AnalyzePlugin")
}

function resolve(...dirs) {
    return path.join(__dirname, '../..', ...dirs);
}

/**
 * 当我们想获取 Cypress 代码覆盖率时，需要将 TEST_ENV 设置为 true。
 * 
 * 这时会打开 babel-loader 配置，去掉 esbuild 配置，并在 babel plugin 中注入 babel-plugin-istanbul
 * 
 * @see https://github.com/istanbuljs/babel-plugin-istanbul
 */
function getAddons() {
    let addons = [
        // for performance reason, only open `@storybook/addon-a11y` when dev a11y
        // '@storybook/addon-a11y',
        '@storybook/addon-toolbars',
    ];

    if (!utils.isTest()) {
        console.log(chalk.yellow(`if you want to get cypress code coverage, set TEST_ENV=test, now it is '${process.env.TEST_ENV}'`));
    }

    return addons;
}

module.exports = {
    framework: {
        name: "@storybook/react-webpack5",
        options: {
            fastRefresh: true
        },
    },
    addons: getAddons(),
    webpackFinal: async (config) => {
        const rules =
            (config.module.rules &&
                config.module.rules.filter(rule => {
                    const test = _.toString(rule && rule.test);
                    if (/\.css/i.test(test) || /\.s(c|a)ss/i.test(test)) {
                        return false;
                    }
                    return true;
                })) ||
            [];
        rules.push(
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
        );
        rules.push(
            {
                test: /\.s(a|c)ss$/,
                include: [resolve('packages/semi-ui'), resolve('packages/semi-foundation'), resolve('packages/semi-icons')],
                use: ['style-loader', 'css-loader', 'sass-loader', resolve('packages/semi-webpack/lib/semi-theme-loader.js')],
            }
        );
        AnalyzePlugin && rules.push({
            test: /\.tsx?$/,
            include: [resolve('packages/semi-ui'), resolve('packages/semi-foundation')],
            exclude:/node_modules/,
            use: [
                {
                    loader: "babel-loader",
                    options: {
                        plugins: [AnalyzePlugin],
                    }
                },
            ]
        })
        rules.push({
            test: /jsonWorkerManager\.ts$/,
            use: [
                {
                    loader: 'webpack-replace-loader',
                    options: {
                        search: '%WORKER_RAW%',
                        replace: () => {
                            const workFilePath = resolve('packages/semi-json-viewer-core/workerLib/worker.js');
                            const result = fs.readFileSync(workFilePath, 'utf-8');
                            const encodedResult = encodeURIComponent(result);
                            return encodedResult;
                        }
                    }
                }
            ]
        });
        config.module.rules = rules;
        config.resolve.extensions.push('.js', '.jsx', '.ts', '.tsx');
        config.resolve.symlinks = false;
        config.mode = "development";
        config.resolve.alias = {
            '@douyinfe/semi-foundation': resolve('packages/semi-foundation'),
            '@douyinfe/semi-icons': resolve('packages/semi-icons/src'),
            '@douyinfe/semi-icons-lab': resolve('packages/semi-icons-lab/src'),
            '@douyinfe/semi-ui': resolve('packages/semi-ui'),
            '@douyinfe/semi-theme-default': resolve('packages/semi-theme-default'),
            '@douyinfe/semi-illustrations': resolve('packages/semi-illustrations/src'),
            '@douyinfe/semi-animation': resolve('packages/semi-animation'),
            '@douyinfe/semi-animation-react': resolve('packages/semi-animation-react'),
            '@douyinfe/semi-animation-styled': resolve('packages/semi-animation-styled'),
            '@douyinfe/semi-json-viewer-core': resolve('packages/semi-json-viewer-core/src'),
        };
        config.devtool = 'source-map';
        // config.output.publicPath = "/storybook/"

        return config;
    }
};

