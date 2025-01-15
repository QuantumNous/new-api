/**
 * @description 处理粘贴逻辑
 * @author wangfupeng
 */
/**
 * 获取粘贴的纯文本
 * @param e Event 参数
 */
export declare function getPasteText(e: ClipboardEvent): string;
/**
 * 获取粘贴的 html 字符串
 * @param e Event 参数
 * @param filterStyle 是否过滤 style 样式
 * @param ignoreImg 是否忽略 img 标签
 */
export declare function getPasteHtml(e: ClipboardEvent, filterStyle?: boolean, ignoreImg?: boolean): string;
/**
 * 获取粘贴的图片文件
 * @param e Event 参数
 */
export declare function getPasteImgs(e: ClipboardEvent): File[];
