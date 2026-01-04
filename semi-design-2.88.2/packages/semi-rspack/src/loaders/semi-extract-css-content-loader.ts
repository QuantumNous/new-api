import { LoaderContext } from 'webpack';

/**
 * 
 * @param {*} source 
 * @returns string
 * @description 
 * 此 loader 用于从 css-loader 处理后的 js 代码中获取纯 css 样式字符串
 * source 是经过 css-loader 处理后的 js 代码。要获取其中的  css 样式字符串，需经过如下操作：
 * 1. 通过识别module.id, "或者module.id, `做为开头，", ""]);或者`, ""]);做为结尾拿到中间的 css 代码
 * 2. 将 文本中的 \n 替换为空字符串
 */
export default function semiExtractCssContentLoader(this: LoaderContext<void>, source: string) {
    const beginContent = 'module.id, ';
    const endContent = ', ""]);';
    let begInIndex = source.indexOf(beginContent);
    let endIndex = source.length;
    let result = source;
    if (begInIndex !== -1) {
        endIndex = source.lastIndexOf(endContent);
        if (endIndex !== -1) {
            result = source.slice(begInIndex + beginContent.length + 1, endIndex - 1);
            result = result.replace(/\\n/g, "");
        }
    }
    return result;
}
  