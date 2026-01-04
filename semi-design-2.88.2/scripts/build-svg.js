/**
 * 转换svg元素成React组件
 */

const svgr = require('@svgr/core').default;
const { optimize } = require('svgo');
const fs = require('fs');
const { resolve, basename, extname } = require('path');
const camelCase = require('camelcase');
const prettier = require('prettier');

/**
 *
 * @param {*} entryDir 存放svg文件夹
 * @param {*} outDir 输出React组件文件夹
 * @param {*} decolorize 是否去色
 * @param {*} prefix 图标前缀
 * @param {*} suffix 图标后缀
 */
async function build(entryDir, outDir, prefix, suffix, svgoPlugins = [], svgrOptions = {}) {
    const prettierConfig = require(resolve(__dirname, '../.prettierrc.js'));
    fs.rmdirSync(outDir, { recursive: true });
    fs.mkdirSync(outDir);
    // 读取svg文件夹下的文件，转译成React组件，并输出
    const files = fs.readdirSync(entryDir, 'utf-8');
    const indexFileName = 'index.ts';
    const batches = files.filter(f => extname(f) === '.svg').map(async file => {
        try {
            const svgFileName = basename(file, '.svg');
            // 此处为对 ai icon 的特殊处理
            let tempName = svgFileName;
            if (svgFileName.startsWith('ai_')) {
                tempName = tempName.replace('ai_', 'a_i_');
            }
            const componentName = `${prefix}${camelCase(tempName, { pascalCase: true })}${suffix}`;
            const reactFileName = `${componentName}.tsx`;
            const svgContent = fs.readFileSync(resolve(entryDir, file), 'utf-8');
            const svgProps = {
                focusable: '{false}',
                'aria-hidden': true
            };
            const result = optimize(svgContent, {
                plugins: svgoPlugins,
            });
            const jsxCode = await svgr(result.data, {
                plugins: ['@svgr/plugin-jsx'],
                svgProps,
                iconType: svgFileName,
                ...svgrOptions,
            });
            const formattedCode = prettier.format(jsxCode, prettierConfig);
            fs.writeFileSync(resolve(outDir, reactFileName), formattedCode, 'utf-8');
            return { fileName: reactFileName, componentName };
        } catch (error) {
            console.error(error);
            throw error;
        }
    });
    const arr = await Promise.all(batches);
    const indexFileContent = arr.map(a => `export { default as ${a.componentName} } from './${a.componentName}';`).join('\n');
    fs.writeFileSync(resolve(outDir, indexFileName), indexFileContent, 'utf-8');
    return arr;
}

module.exports = build;