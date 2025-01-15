/**
 * @description 将粘贴的 html 字符串，转换为正确、简洁的 html 代码。剔除不必要的标签和属性。
 * @author wangfupeng
 */
/**
 * 处理粘贴的 html
 * @param html html 字符串
 * @param filterStyle 是否过滤 style 样式
 * @param ignoreImg 是否忽略 img 标签
 */
declare function parseHtml(html: string, filterStyle?: boolean, ignoreImg?: boolean): string;
export default parseHtml;
