import path from 'path';
import fs from 'fs-extra';
import { set } from 'lodash';

const lodash = { set };

const generateComponentsScssMap = (foundationPath: string, iconPath?: string) => {
    const foundationComponentList = fs.readdirSync(foundationPath);
    const componentScssMap: { [componentName: string]: { [scssFileName: string]: string } } = {};
    foundationComponentList.forEach(fileName => {
        const fileAbsolutePath = path.join(foundationPath, fileName);
        if (fs.existsSync(fileAbsolutePath) && fs.statSync(fileAbsolutePath).isDirectory()) {
            //in component folder
            const componentPath = fileAbsolutePath;
            const scssFileList = fs.readdirSync(componentPath).filter((fileName) => fileName.endsWith('.scss'));
            scssFileList.forEach(scssFileName => {
                let scssRaw = fs.readFileSync(path.join(componentPath, scssFileName), { encoding: 'utf-8' });
                scssRaw = `\n\n//----${fileName}/${scssFileName} start-----\n` + scssRaw + `\n\n//----${fileName}/${scssFileName} end-----\n`;
                lodash.set(componentScssMap, [fileName, scssFileName], scssRaw);
            });
        }
    });

    if (iconPath) {
        //for react icon
        const stylePath = path.join(iconPath, 'src', 'styles');
        const scssFileList = fs.readdirSync(stylePath).filter((fileName) => fileName.endsWith('.scss'));
        scssFileList.forEach(scssFileName => {
            let scssRaw = fs.readFileSync(path.join(stylePath, scssFileName), { encoding: 'utf-8' });
            scssRaw = `\n\n//----${stylePath}/${scssFileName} start-----\n` + scssRaw + `\n\n//----${stylePath}/${scssFileName} end-----\n`;
            lodash.set(componentScssMap, ['icons', scssFileName], scssRaw);
        });
    }


    return componentScssMap;
};


const generateThemeScssMap = (themePath: string) => {
    const fileList = ['_font.scss', '_palette.scss', 'global.scss', 'animation.scss', 'index.scss', 'local.scss', 'mixin.scss', 'variables.scss', 'custom.scss'] as const;
    const themeScssMap: { [key in typeof fileList[number]]?: string } = {};
    for (const fileName of fileList) {
        const scssAbsolutePath = path.join(themePath, 'scss', fileName);
        if (fs.existsSync(scssAbsolutePath)) {
            //in theme folder
            themeScssMap[fileName] = fs.readFileSync(scssAbsolutePath, { encoding: 'utf8' });
        }
    }
    // console.log(themeScssMap)
    return themeScssMap;
};


const generateScssMap = (foundationPath: string, themePath: string, iconPath: string) => {
    return {
        components: generateComponentsScssMap(foundationPath, iconPath),
        theme: generateThemeScssMap(themePath),
    };
};

export default generateScssMap;
