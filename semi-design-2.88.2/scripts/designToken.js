const fs = require('fs');
const path = require('path');
const lodash = require('lodash');
const { mergeWith } = require("lodash");


const isComment = codeLine => lodash.startsWith(codeLine, '//') || lodash.startsWith(codeLine, '/*');
const getTokenCategory = codeLine => {
    const categorySet = new Set(['color', 'width', 'height', 'spacing', 'radius', 'font', 'motion', "animation", "transition"]);
    const firstWord = lodash.get(codeLine.match(/\$([\w\W]+?)[-_]/), 1, { toLowerCase: () => null }).toLowerCase();
    if (firstWord) {
        return categorySet.has(firstWord) ? firstWord : 'other';
    } else {
        return 'other';
    }
};
const codeLineSplit = codeLine => {
    const [key, value, comment] = codeLine.split(/:|\/\/|\/\*/).map(code => code.trim()).filter(code => code);
    let category = getTokenCategory(codeLine);
    if (category==='transition') {
        category = "animation";
    }
    return { key, value: lodash.trimEnd(value, ';'), comment: comment && comment.replace("ignore-semi-css-trans", ""), category: category, raw: codeLine };
};

const getGlobalDesignToken = () => {
    const globalScssContentArray = fs.readFileSync(path.join(__dirname, '../packages/semi-theme-default/scss/global.scss'), { encoding: 'utf-8' }).split('\n');
    const paletteScssContentArray = fs.readFileSync(path.join(__dirname, '../packages/semi-theme-default/scss/_palette.scss'), { encoding: 'utf-8' }).split('\n');
    const animationScssContentArray = fs.readFileSync(path.join(__dirname, '../packages/semi-theme-default/scss/animation.scss'), { encoding: 'utf-8' }).split('\n');
    const normalContentArray = fs.readFileSync(path.join(__dirname, '../packages/semi-theme-default/scss/variables.scss'), { encoding: 'utf-8' }).split('\n');
    const getLightAndDarkScss = scssFileContentArray => {
        const contentArray = scssFileContentArray.map(codeLine => codeLine.trim())
            .filter(codeLine => codeLine && !isComment(codeLine))
            .filter(codeLine => !codeLine.startsWith('}'))
            .filter(codeLine => !codeLine.startsWith('@'));
        // {key,value,category,raw};
        const rawData = {
            light: [],
            dark: []
        };
        let currentMode = 'light';
        for (let i in contentArray) {
            i = Number(i);
            const codeLine = contentArray[i];
            if (/body/.test(codeLine)) {
                if (/semi-always-dark/.test(codeLine)) {
                    currentMode = 'dark';
                }
                continue;
            }

            rawData[currentMode].push(codeLineSplit(codeLine));
        }
        return rawData;
    };

    let globalScssContent = getLightAndDarkScss(globalScssContentArray);
    let paletteContent = getLightAndDarkScss(paletteScssContentArray);

    const mergeCommentLightToDark = content => {
        const map = new Map();
        content.light.forEach(token => {
            const { key } = token;
            map.set(key, { light: token });
        });
        content.dark.forEach(token => {
            const { key } = token;
            const data = map.get(key);
            if (!data) {
                console.warn(`${key} in dark but not in light`);
                return;
            }
            data.dark = token;
        });
        Array.from(map.values()).forEach(({ light, dark }) => {
            if (!dark.comment) {
                dark.comment = light.comment;
            }
        });
        return content;
    };
    globalScssContent = mergeCommentLightToDark(globalScssContent);
    paletteContent = mergeCommentLightToDark(paletteContent);

    const normalContent = normalContentArray.map(codeLine => codeLine.trim())
        .filter(codeLine => codeLine && !isComment(codeLine))
        .map(codeLine => codeLineSplit(codeLine));

    const animationContent = animationScssContentArray.map(codeLine => codeLine.trim())
        .filter(codeLine => codeLine && !isComment(codeLine))
        .filter(codeLine => !codeLine.startsWith('body'))
        .filter(codeLine => !codeLine.startsWith('}'))
        .filter(codeLine => !codeLine.startsWith('@'))
        .map(codeLine=>codeLineSplit(codeLine)).map(token=>{
            token.category="animation";
            return token;
        });
    return { global: globalScssContent, palette: paletteContent, normal: normalContent, animation: animationContent };
};

// 官网组件 design token 注入
async function main() {
    const componentVariablesMap = {};
    const animationVariablesMap = {};
    const semiUIDir = path.join(__dirname, '../packages/semi-foundation');
    fs.readdirSync(semiUIDir).map(dirname => {
        const variableSCSSPath = path.join(semiUIDir, dirname, 'variables.scss');
        if (fs.existsSync(variableSCSSPath)) {
            const raw = fs.readFileSync(variableSCSSPath, { encoding: 'utf-8' });
            const scssCodeLineList = raw.split('\n').filter(codeLine => codeLine && !isComment(codeLine));
            componentVariablesMap[dirname.toLowerCase()] = scssCodeLineList.map(codeLine => codeLineSplit(codeLine));
        }
        const animationSCSSPath = path.join(semiUIDir, dirname, 'animation.scss');
        if (fs.existsSync(animationSCSSPath)) {
            const raw = fs.readFileSync(animationSCSSPath, { encoding: 'utf-8' });
            const scssCodeLineList = raw.split('\n').filter(codeLine => codeLine && !isComment(codeLine));
            animationVariablesMap[dirname.toLowerCase()] = scssCodeLineList.map(codeLine => codeLineSplit(codeLine));
        }
    });
    mergeWith(componentVariablesMap, animationVariablesMap, (objValue, srcValue)=>{
        if (Array.isArray(objValue)) {
            return objValue.concat(srcValue);
        }
    });
    componentVariablesMap.global = getGlobalDesignToken();
    const [_, __, savePath] = process.argv;
    fs.writeFileSync(savePath || './designToken.json', JSON.stringify(componentVariablesMap));
}

main();
