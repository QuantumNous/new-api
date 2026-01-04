/* eslint-disable max-lines-per-function */
/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const path = require('path');
const fs = require('fs');
const items = ['basic', 'chart'];
const sha1 = require('sha1');
const hash = sha1(`${new Date().getTime()}${Math.random()}`);
const numHash = Math.round(Math.random() * 1000000);
const glob = require('glob');


function resolve(...dirs) {
    return path.resolve(__dirname, ...dirs);
}
const getLocale = path => {
    let pathname = path || window.location.pathname;
    let locale = 'zh-CN';
    if (/en-US/.test(pathname)) {
        locale = 'en-US';
    }
    return locale;
};

exports.onCreateWebpackConfig = ({ stage, rules, loaders, plugins, actions }) => {
    const isSSR = stage.includes('html');
    const sassLoader = () => 'sass-loader';
    const miniCssExtract = (...args) => loaders.miniCssExtract(...args);
    const cssLoader = (options = {}) => ({
        loader: 'css-loader',
        options: {
            ...options,
        },
    });

    const semiOptions = { esbuild: true };
    const srcScssModuleUse = [];
    const srcScssUse = [];
    const srcCssUse = [];


    // for semi
    semiOptions.scssUse = [
        loaders.css({
            importLoaders: 3,
        }),
        loaders.postcss(),
        sassLoader(),
    ];
    semiOptions.cssUse = [loaders.css({ importLoaders: 1 }), loaders.postcss()];
    semiOptions.scssPaths = [resolve('packages/semi-foundation'), resolve('packages/semi-ui'), resolve('packages/semi-icons')],
    semiOptions.paths = [
        function check(path) {
            return (
                (/packages\/semi-foundation/i.test(path) ||
                     /packages\/semi-ui/i.test(path) ||
                     /packages\/semi-icons/i.test(path)) &&
                 !(/packages\/semi-foundation\/node_modules/i.test(path) || /packages\/semi-ui\/node_modules/i.test(path))
            );
        },
    ];
    semiOptions.extract = isSSR
        ? {
            loader: { loader: MiniCssExtractPlugin.loader, options: {} },
        }
        : false;
    // for src
    srcScssModuleUse.push(
        cssLoader({
            importLoaders: 2,
            modules: {
                localIdentName: '[local]--[hash:base64:5]',
            },
            onlyLocals: isSSR,
            localsConvention: 'camelCase',
        }),
        loaders.postcss(),
        sassLoader()
    );
    srcScssUse.push(cssLoader({ importLoaders: 2 }), loaders.postcss(), sassLoader());
    srcCssUse.push(cssLoader({ importLoaders: 1 }), loaders.postcss());
    if (!isSSR) {
        [semiOptions.scssUse, semiOptions.cssUse, srcScssModuleUse, srcScssUse, srcCssUse].forEach(
            arr => {
                arr.unshift(miniCssExtract());
            }
        );
    }
    console.log(["node_modules", resolve("node_modules")]);
    actions.setWebpackConfig({
        externals: {
            "node:url": "url",
            "node:path": "path",
            "node:process": "process",
        },
        resolve: {
            alias: {
                "vfile/do-not-use-conditional-minurl": isSSR ? "vfile/lib/minurl.js" : "vfile/lib/minurl.browser.js",
                "vfile/do-not-use-conditional-minproc": isSSR ? "vfile/lib/minproc.js" : "vfile/lib/minproc.browser.js",
                "vfile/do-not-use-conditional-minpath": isSSR ? "vfile/lib/minpath.js" : "vfile/lib/minpath.browser.js",
                "#minpath": isSSR ? "vfile/lib/minpath.js" : "vfile/lib/minpath.browser.js",
                "#minproc": isSSR ? "vfile/lib/minproc.js" : "vfile/lib/minproc.browser.js",
                "#minurl": isSSR ? "vfile/lib/minurl.js" : "vfile/lib/minurl.browser.js",
                "estree-util-visit/do-not-use-color": isSSR ? "estree-util-visit/lib/color.node.js" : "estree-util-visit/lib/color.default.js",
                "devlop": "devlop/lib/default.js",
                "unist-util-visit-parents/do-not-use-color": isSSR ? "unist-util-visit-parents/lib/color.node.js" : "unist-util-visit-parents/lib/color.js",
                'semi-site-header': process.env.SEMI_SITE_HEADER || '@douyinfe/semi-site-header',
                'semi-site-banner': process.env.SEMI_SITE_BANNER || '@douyinfe/semi-site-banner',
                'univers-webview': process.env.SEMI_SITE_UNIVERS_WEBVIEW || resolve('packages/semi-ui'),
                '@douyinfe/semi-json-viewer-core': resolve('packages/semi-json-viewer-core/src'),
                '@douyinfe/semi-ui': resolve('packages/semi-ui'),
                '@douyinfe/semi-foundation': resolve('packages/semi-foundation'),
                '@douyinfe/semi-icons': resolve('packages/semi-icons/src/'),
                '@douyinfe/semi-icons-lab': resolve('packages/semi-icons-lab/src/'),
                '@douyinfe/semi-theme-default': resolve('packages/semi-theme-default'),
                '@douyinfe/semi-illustrations': resolve('packages/semi-illustrations/src/'),
                '@douyinfe/semi-animation-react': resolve('packages/semi-animation-react/'),
                '@douyinfe/semi-animation-styled': resolve('packages/semi-animation-styled/'),
                'services': resolve('src/services'),
                'utils': resolve('src/utils'),
                'context': resolve('src/context'),
                'components': resolve('src/components'),
                'locale': resolve('src/locale'),
                'src': resolve('src')
            },
            extensions: ["*", ".mjs", ".js", ".json"]
        },
        module: {
            rules: [
                {
                    include: [path.resolve(__dirname, 'src')],
                    oneOf: [
                        {
                            test: /\.module\.s(a|c)ss$/,
                            use: [...srcScssModuleUse],
                        },
                        {
                            test: /\.s(a|c)ss$/,
                            use: [...srcScssUse],
                        },
                        {
                            test: /\.css$/,
                            use: [...srcCssUse],
                        },
                    ],
                },
                {
                    test: /\.s(a|c)ss$/,
                    include: [resolve('packages/semi-ui'), resolve('packages/semi-foundation'), resolve('packages/semi-icons')],
                    use: [...srcScssUse, resolve('packages/semi-webpack/lib/semi-theme-loader.js')],
                },
                {
                    test: /\.m?js/,
                    include: [/micromark-util-sanitize-uri/, /mdast-util-from-markdown/, /micromark/, /mdast-util-to-markdown/, /semi-foundation\/node_modules\/@mdx-js/, /jsonc-parser/],
                    use: ["esbuild-loader"]
                },
                {
                    test: [/\.jsx?$/, /\.mjs/],
                    include: [path.resolve(__dirname, 'src')],
                    use: {
                        loader: 'esbuild-loader',
                        options: {
                            loader: 'jsx', // Remove this if you're not using JSX
                            target: 'esnext' // Syntax to compile to (see options below for possible values)
                        },
                    },
                },
                {
                    test: /jsonWorkerManager\.ts$/,
                    use: [{
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
                    }],
                },
                {
                    test: [/\.tsx?$/],
                    include: [path.resolve(__dirname, 'src')],
                    use: [{
                        loader: 'esbuild-loader',
                        options: {
                            loader: 'tsx', // Remove this if you're not using JSX
                            target: 'esnext' // Syntax to compile to (see options below for possible values)
                        },
                    }],
                },
                {
                    test: /\.mjs$/,
                    include: /node_modules/,
                    type: "javascript/auto"
                },
                { test: /\.worker\.ts$/, use: ['worker-loader', 'ts-loader'] }
            ],
        },
        plugins: [plugins.extractText(), plugins.define({
            "THEME_SWITCHER_URL": JSON.stringify(process.env['THEME_SWITCHER_URL']),
            "MATERIAL_LIST_URL": JSON.stringify(process.env['MATERIAL_LIST_URL']),
            "SEMI_SEARCH_URL": JSON.stringify(process.env['SEMI_SEARCH_URL']),
            "DSM_URL": JSON.stringify(process.env['DSM_URL']),
            'process.env.SEMI_SITE_HEADER': JSON.stringify(process.env.SEMI_SITE_HEADER),
            'process.env.SEMI_SITE_BANNER': JSON.stringify(process.env.SEMI_SITE_BANNER),
            "process.env.SEMI_SITE_UNIVERS_WEBVIEW": JSON.stringify(process.env.SEMI_SITE_UNIVERS_WEBVIEW),
            'process.env.D2C_URL': JSON.stringify(process.env.D2C_URL),
            "ASSET_PREFIX": JSON.stringify((process.env['CDN_OUTER_CN'] || process.env['CDN_INNER_CN']) ? `https://${(process.env['CDN_OUTER_CN'] || process.env['CDN_INNER_CN'])}/${process.env['CDN_PATH_PREFIX']}` : ""),
        })],
    });
};

exports.onCreateNode = ({ node, getNode, actions }) => {
    const { createNodeField } = actions;

    if (node.internal.type === 'Mdx') {
        const mdxNode = getNode(node.parent);
        const levels = mdxNode.relativePath.split(path.sep);

        const locale = getLocale(mdxNode.name);

        createNodeField({
            node,
            name: 'slug',
            value: `${locale}/${levels[0]}/${levels[1]}`, // eg: zh-CN/chart/area
        });

        createNodeField({
            node,
            name: 'type',
            value: `${levels[0]}`,
        });

        createNodeField({
            node,
            name: 'typeOrder',
            value: items.indexOf(levels[0]),
        });

        createNodeField({
            node,
            name: 'locale',
            value: locale,
        });
    }
};

exports.onPreBootstrap = ({ Joi }) => {
    let orderFunc = require('./content/order');
    console.log('starting order mdx');
    orderFunc();
};

exports.createPages = async ({ actions, graphql, reporter }) => {
    const { createPage } = actions;

    const blogPostTemplate = path.resolve('src/templates/postTemplate.js');

    const result = await graphql(`
         query {
             allMdx(
                 filter: { fields: { type: { nin: ["principles", "concepts"] } } }
                 sort: { order: ASC, fields: [frontmatter___order, fields___locale, fields___typeOrder, fields___slug] }
             ) {
                 edges {
                     previous {
                         fields {
                             slug
                         }
                         id
                         frontmatter {
                             title
                             localeCode
                             icon
                             showNew
                         }
                     }
                     node {
                         fields {
                             slug
                         }
                         id
                         frontmatter {
                             localeCode
                             order
                             icon
                             showNew
                         }
                     }
                     next {
                         fields {
                             slug
                         }
                         id
                         frontmatter {
                             title
                             localeCode
                             icon
                             showNew
                         }
                     }
                 }
             }
         }
     `);
    // Handle errors
    if (result.errors) {
        reporter.panicOnBuild('Error while running GraphQL query.');
        return;
    }

    result.data.allMdx.edges.forEach(({ next, previous, node }) => {
        createPage({
            path: node.fields.slug,
            // path: node.frontmatter.localeCode ? node.frontmatter.localeCode + '/' +  node.fields.slug : 'zh-CN/' + node.fields.slug,
            component: blogPostTemplate,
            context: {
                slug: node.fields.slug,
                next,
                previous,
                // id: node.id,
            },
        });
    });
};


exports.onPostBuild = async () => {
    const publicPath = path.join(__dirname, 'public');
    const replacedNameSet = new Set();
    const pageDataFiles = glob.sync(`${publicPath}/page-data/**/*.json`);
    for (let file of pageDataFiles) {
        const newFilename = file.replace(/([a-zA-Z0-9\-]+)\.json/g, (_, p1)=> {
            replacedNameSet.add(p1);
            return `${p1}${/^\d+$/.test(p1) ? numHash : `.${hash}`}.json`;
        });
        fs.renameSync(file, newFilename);
    }
    
    const htmlAndJSFiles = glob.sync(`${publicPath}/**/*.{html,js}`);
    for (let file of htmlAndJSFiles) {
        const stats = fs.statSync(file);
        if (stats.isFile()) {
            if (file.includes("public/editor")) {
                continue;
            }
            let content = fs.readFileSync(file, 'utf8');
            let result = content.replace(/([a-zA-Z0-9\-]+)\.json/g, (_, p1)=>{
                if (replacedNameSet.has(p1) && !/^\d+$/.test(p1)) {
                    const newFileName = `${p1}.${hash}.json`;
                    console.log(`Add hash to json in ${file} from ${p1}.json to ${newFileName} ..`);
                    return newFileName;
                } else {
                    return `${p1}.json`;
                }
            });
            result = result.replace(/designToken.json(\?v=[a-f0-9]*)?/g,
                `designToken.json?v=${hash}`);
            fs.writeFileSync(file, result, 'utf8');
        }
    }

    console.log("Num json set ", Array.from(replacedNameSet));

    //only match nav json (only number)
    const jsonFiles = glob.sync(`${publicPath}/**/*.{js,html,json}`);
    for (let file of jsonFiles) {
        if (file.includes("public/editor")) {
            continue;
        }
        const stats = fs.statSync(file);
        if (stats.isFile()) {
            console.log("Notice: Add Hash to JSON File " + file);
            if (file.includes("public/editor")) {
                continue;
            }
            let result = fs.readFileSync(file, 'utf8');

            for (let name of replacedNameSet) {
                if (/^\d+$/.test(name)) {
                    result = result.replaceAll(name, `${name}${numHash}`);
                }

            }
            result = result.replace(/designToken.json(\?v=[a-f0-9]*)?/g,
                `designToken.json?v=${hash}`);
            fs.writeFileSync(file, result, 'utf8');
        }
    }

    (()=>{
        const jsFiles = glob.sync(`${publicPath}/*.js`);
        const mapFiles = glob.sync(`${publicPath}/*.map`);
        const replaceNames = {};

        for (let file of jsFiles) {
            const filename = path.basename(file);
            const fileNameWithoutExt = filename.split('.')[0];
            const originHash = fileNameWithoutExt.split('-').at(-1);

            if (originHash && originHash !== fileNameWithoutExt) {
                let fileNameWithoutExtWithHash = fileNameWithoutExt.replace(originHash, `${originHash}${numHash}`);
                replaceNames[originHash] = `${originHash}${numHash}`;
                fs.renameSync(file, path.join(path.dirname(file), `${fileNameWithoutExtWithHash}.js`));
            } else {
                let finalFileName = `${fileNameWithoutExt}${numHash}.js`;
                replaceNames[filename] = finalFileName;
                fs.renameSync(file, path.join(path.dirname(file), finalFileName));
            }
        }

        for (let file of mapFiles) {
            const filename = path.basename(file);
            const fileNameWithoutExt = filename.split('.')[0];
            const originHash = fileNameWithoutExt.split('-').at(-1);

            if (originHash && originHash !== fileNameWithoutExt) {
                let fileNameWithoutExtWithHash = fileNameWithoutExt.replace(originHash, `${originHash}${numHash}`);
                replaceNames[originHash] = `${originHash}${numHash}`;
                fs.renameSync(file, path.join(path.dirname(file), `${fileNameWithoutExtWithHash}.js.map`));
            } else {
                let finalFileName = `${fileNameWithoutExt}${numHash}.js.map`;
                replaceNames[filename] = finalFileName;
                fs.renameSync(file, path.join(path.dirname(file), finalFileName));
            }
        }



        const allFiles = glob.sync(`${publicPath}/**/*.{js,html,json}`);
        for (let file of allFiles) {
            const stats = fs.statSync(file);
            if (stats.isFile()) {
                let result = fs.readFileSync(file, 'utf8');
                for (let [oldName, newName] of Object.entries(replaceNames)) {
                    result = result.replaceAll(oldName, newName);
                }
                fs.writeFileSync(file, result, 'utf8');
            }
        }
    })();



    (()=>{
        const cssFiles = glob.sync(`${publicPath}/*.css`);

        const replaceNames = {};
        for (let file of cssFiles) {
            const { base: filename, name: fileNameWithoutExt } = path.parse(file);
            const originHash = fileNameWithoutExt.split('.').at(-1);


            if (originHash && originHash !== fileNameWithoutExt) {
                let fileNameWithoutExtWithHash = fileNameWithoutExt.replace(originHash, `${originHash}${numHash}`);
                replaceNames[originHash] = `${originHash}${numHash}`;
                fs.renameSync(file, path.join(path.dirname(file), `${fileNameWithoutExtWithHash}.css`));
            } else {
                let finalFileName = `${fileNameWithoutExt}${numHash}.css`;
                replaceNames[filename] = finalFileName;
                fs.renameSync(file, path.join(path.dirname(file), finalFileName));
            }

        }
        const allFiles = glob.sync(`${publicPath}/**/*.{js,html,json}`);
        for (let file of allFiles) {
            const stats = fs.statSync(file);
            if (stats.isFile()) {
                let result = fs.readFileSync(file, 'utf8');
                for (let [oldName, newName] of Object.entries(replaceNames)) {
                    result = result.replaceAll(oldName, newName);
                }
                fs.writeFileSync(file, result, 'utf8');
            }
        }
    })();



};
