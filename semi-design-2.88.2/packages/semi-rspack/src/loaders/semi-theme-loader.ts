import { LoaderContext } from 'webpack';
import resolve from 'enhanced-resolve';
import componentVariablePathList from '../componentName';

export interface SemiThemeLoaderOptions {
    prefixCls: string;
    variables: string;
    include: string;
    name?: string;
    cssLayer?: boolean
}

export default function SemiThemeLoader(this: LoaderContext<SemiThemeLoaderOptions>, source: string) {
    const query = this.getOptions();
    const theme = query.name || '@douyinfe/semi-theme-default';
    const cssLayer = query.cssLayer ?? false as boolean;
    // always inject
    const scssVarStr = `@import "~${theme}/scss/index.scss";\n`;
    // inject once
    const cssVarStr = `@import "~${theme}/scss/global.scss";\n`;
    let animationStr = `@import "~${theme}/scss/animation.scss";\n`;

    try {
        require.resolve(`${theme}/scss/animation.scss`);
    } catch (e) {
        animationStr = ''; // fallback to empty string
    }

    const shouldInject = source.includes('semi-base');

    let fileStr = source;

    let componentVariables: string | boolean;
    try {
        componentVariables = resolve.sync(this.context, `${theme}/scss/local.scss`);
    } catch (e) {}

    if (query.include || query.variables || componentVariables) {
        let localImport = '';
        if (componentVariables) {
            localImport += `\n@import "~${theme}/scss/local.scss";`;
        }
        if (query.include) {
            localImport += `\n@import "${query.include}";`;
        }
        if (query.variables) {
            localImport += `\n${query.variables}`;
        }
        try {
            const regex = /(@import '.\/variables.scss';?|@import ".\/variables.scss";?)/g;
            const fileSplit = source.split(regex).filter(item => Boolean(item));
            if (fileSplit.length > 1) {
                fileSplit.splice(fileSplit.length - 1, 0, localImport);
                fileStr = fileSplit.join('');
            }
        } catch (error) {}
    }

    // inject prefix
    const prefixCls = query.prefixCls || 'semi';

    const prefixClsStr = `$prefix: '${prefixCls}';\n`;
    let finalCSS: string = "";
    if (shouldInject) {

        const customStr = (() => {
            let customStr = '';
            try {
                if (!resolve.sync(this.context, `${theme}/scss/custom.scss`)) {
                    return '';
                }
                const collectAllVariablesPath: string[] = [
                    ...componentVariablePathList,
                ];
                if (componentVariables) {
                    collectAllVariablesPath.push(`${theme}/scss/local.scss`);
                }
                collectAllVariablesPath.push(`${theme}/scss/custom.scss`);
                customStr = collectAllVariablesPath.map(p => {
                    return `@import "~${p}";`;
                }).join('\n') + '\n' + customStr;

            } catch (e) {
                customStr = ''; // fallback to empty string
            }
            return `body:not(:not(body)){${customStr}};`;
        })();

        finalCSS = `${animationStr}${cssVarStr}${scssVarStr}${prefixClsStr}${fileStr}${customStr}`;
    } else {
        finalCSS = `${scssVarStr}${prefixClsStr}${fileStr}`;
    }
    if (cssLayer) {
        finalCSS = `@layer semi{${finalCSS}}`;
    }
    return finalCSS;
}
