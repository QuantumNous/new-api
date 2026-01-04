import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import generateScssMap from './generateSCSSMap';
import { omit } from 'lodash';
import copy from 'fast-copy';


const lodash = { omit };

const writeComponentScss = (scssMap: { [p: string]: { [p: string]: string } }, tempDir: string) => {
    for (const componentName of Object.keys(scssMap)) {
        const componentDirPath = path.join(tempDir, 'components', componentName);
        fs.emptyDirSync(componentDirPath);
        for (const scssFileName of Object.keys(scssMap[componentName])) {
            fs.writeFileSync(path.join(componentDirPath, scssFileName), scssMap[componentName][scssFileName], { encoding: 'utf-8' });
        }
    }
    return;
};

const writeThemeScss = (scssMap: (ReturnType<typeof generateScssMap>)['theme'], tempDir: string) => {
    const themeDirPath = path.join(tempDir, 'theme');
    fs.emptyDirSync(themeDirPath);

    for (const scssFileName of Object.keys(scssMap)) {
        fs.writeFileSync(path.join(themeDirPath, scssFileName), scssMap[scssFileName as keyof typeof scssMap] as string, { encoding: 'utf8' });
    }
    return;
};

const preProcessScssMap = (scssMapOrigin: ReturnType<typeof generateScssMap>) => {
    const scssMap = copy(scssMapOrigin);

    //----- generate entry -----
    let compilerEntryContent = '';
    compilerEntryContent += `@import "./theme/index.scss";\n`;
    compilerEntryContent += `@import "./theme/global.scss";\n`;
    if (scssMap.theme?.["animation.scss"]) {
        compilerEntryContent += `@import "./theme/animation.scss";\n`;
    }

    for (const componentName of Object.keys(scssMap['components'])) {
        let scssFileName = `${componentName}.scss`;
        //edge case portal keyframes, cause their folderName and scssFilename not match.
        if (componentName === '_portal') {
            scssFileName = 'portal.scss';
        } else if (componentName === 'keyframes') {
            scssFileName = 'rotate.scss';
        }
        compilerEntryContent += `@import "./components/${componentName}/${scssFileName}";\n`;
    }
    //edge case for iconButton and textarea
    compilerEntryContent += `@import "./components/button/iconButton.scss";\n`;
    compilerEntryContent += `@import "./components/input/textarea.scss";\n`;
    //----- generate entry end -----


    //----- inject component token file local.scss to component's variables.scss -----
    const themeLocalRaw = scssMap.theme['local.scss'];
    if (themeLocalRaw) {
        for (const componentName of Object.keys(scssMap['components'])) {
            if (scssMap['components'][componentName]['variables.scss']) {
                scssMap['components'][componentName]['variables.scss'] += `\n\n\n\n//inject custom theme variables\n${themeLocalRaw}`;
            }
        }
    }

    //---- inject custom file custom.scss to component's variables.scss -----
    const customScssRaw = scssMap.theme['custom.scss'];
    let allCustomRaw = '';
    if (customScssRaw) {
        const componentNames = Object.keys(scssMap['components']);
        const orderList = ['tooltip', 'anchor', 'autoComplete', 'avatar', 'backtop', 'badge', 'banner', 'breadcrumb', 'button', 'calendar', 'card', 'carousel', 'cascader', 'checkbox', 'collapse', 'collapsible', 'datePicker', 'descriptions', 'divider', 'dropdown', 'empty', 'form', 'grid', 'highlight', 'image', 'input', 'inputNumber', 'list', 'modal', 'navigation', 'notification', 'pagination', 'popconfirm', 'popover', 'progress', 'radio', 'rating', 'scrollList', 'select', 'sideSheet', 'skeleton', 'slider', 'space', 'spin', 'steps', 'switch', 'table', 'tabs', 'tag', 'tagInput', 'timePicker', 'timeline', 'toast', 'transfer', 'tree', 'treeSelect', 'typography', 'upload'];

        componentNames.sort((a, b)=>{
            return orderList.indexOf(a) - orderList.indexOf(b);
        });

        for (const componentName of componentNames) {
            if (scssMap['components'][componentName]['variables.scss']) {
                allCustomRaw += scssMap['components'][componentName]['variables.scss'] + '\n';
            }
        }
        allCustomRaw += themeLocalRaw || "";
        allCustomRaw += "\n";
        allCustomRaw += `body:not(:not(body)){${customScssRaw}};` + "\n";
        scssMap.theme['index.scss'] += '\n' + allCustomRaw;
    }

    //----- inject end -----

    return {
        ...{
            components: scssMap['components'],
            theme: lodash.omit(scssMap['theme'], 'local.scss', 'custom.scss')
        },
        index: compilerEntryContent
    };
};


const writeFile = (scssMap: ReturnType<typeof generateScssMap>, tempDir: string = path.join(os.tmpdir(), `semi_scss_compile_${Date.now()}`)) => {
    fs.emptyDirSync(tempDir);

    const finalScssMapWaitForCompiling = preProcessScssMap(scssMap);
    writeComponentScss(finalScssMapWaitForCompiling['components'], tempDir);
    writeThemeScss(finalScssMapWaitForCompiling['theme'], tempDir);
    //write compile entry
    fs.writeFileSync(path.join(tempDir, 'index.scss'), finalScssMapWaitForCompiling['index'], { encoding: 'utf8' });
    return tempDir;
};

export default writeFile;
