"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genCSSModulesCode = void 0;
function genCSSModulesCode(id, index, request, moduleName, needsHotReload) {
    const styleVar = `style${index}`;
    let code = `\nimport ${styleVar} from ${request}`;
    // inject variable
    const name = typeof moduleName === 'string' ? moduleName : '$style';
    code += `\ncssModules["${name}"] = ${styleVar}`;
    if (needsHotReload) {
        code += `
if (module.hot) {
  module.hot.accept(${request}, () => {
    cssModules["${name}"] = ${styleVar}
    __VUE_HMR_RUNTIME__.rerender("${id}")
  })
}`;
    }
    return code;
}
exports.genCSSModulesCode = genCSSModulesCode;
