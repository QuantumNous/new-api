import loadSassCompiler from "./loadSassCompiler";
import { themeScssContent } from './themeDefaultScssContent';
import { componentsScssContent } from "./componentsScssContent";

export async function compile(customVariables) {
    if (!customVariables) {
        return '';
    }
    const compiler = await loadSassCompiler();

    const customVariablesString = Object.entries(customVariables).reduce((acc, cur) => {
        const [key, value] = cur;
        acc += `${key}: ${value};\n`;
        return acc;
    }, '');

    await compiler.writeFilePromisify({
        'custom.scss': customVariablesString,
    });

    const modifiedComponentScssFiles = insertCustomVariables('../custom.scss');

    await compiler.writeFilePromisify({
        ...themeScssContent,
        ...componentsScssContent,
        ...modifiedComponentScssFiles
    });

    return new Promise(resolve => {
        // hack sass.js write file bug
        setTimeout(() => {

            const componentScssEntry = Object.keys(componentsScssContent).filter(path => path.includes('index.scss'));
            const entryString = componentScssEntry.reduce((acc, path) => {
                acc += `@import '${path}';`;
                return acc;
            }, '');

            compiler.compile(`@import 'theme/index.scss';${entryString}`, (res) => {
                if (res.status === 0) {
                    console.log(res);
                    resolve(res.text);
                } else {
                    console.dir(res);
                    resolve("");
                }
            });
        });
    }).finally(() => {
        compiler.clearFiles();
    });
}

function insertCustomVariablesTo(source, customVariablesPath) {
    if (!customVariablesPath) {
        return source;
    }

    const localImport = `\n@import "${customVariablesPath}";`;

    let fileStr = source;
    try {
        const regex = /(@import '.\/variables.scss';?|@import ".\/variables.scss";?)/g;
        const fileSplit = source.split(regex).filter(item => Boolean(item));
        if (fileSplit.length > 1) {
            fileSplit.splice(fileSplit.length - 1, 0, localImport);
            fileStr = fileSplit.join('');
        }
    } catch (error) {}
    return fileStr;
}

export function insertCustomVariables(customVariablesPath) {

    const componentScssEntry = Object.keys(componentsScssContent).filter(path => path.includes('index.scss'));

    const modifiedFiles = componentScssEntry.reduce((acc, cur) => {
        const content = componentsScssContent[cur];
        const newContent = insertCustomVariablesTo(content, customVariablesPath);
        acc[cur] = newContent;
        return acc;
    }, {});

    const themeVariableContent = themeScssContent['theme/variables.scss'];
    const newThemeVariableContent = themeVariableContent + `\n@import "${customVariablesPath}";`;

    return {
        ...modifiedFiles,
        'theme/variables.scss': newThemeVariableContent,
    };
} 

export function insertStyleToDocument(css) {
    let styleEle = document.querySelector('#customStyle');
    if (!styleEle) {
        styleEle = document.createElement("style");
        styleEle.setAttribute('id', 'customStyle');
        document.head.appendChild(styleEle);
    }
    styleEle.textContent = `${css}`;
}

export function removeStyleFromDocument() {
    let styleEle = document.querySelector('#customStyle');
    styleEle && styleEle.remove();
}