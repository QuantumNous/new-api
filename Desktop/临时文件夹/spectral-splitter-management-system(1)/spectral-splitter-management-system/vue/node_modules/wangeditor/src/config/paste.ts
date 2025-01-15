/**
 * @description 粘贴，配置文件
 * @author wangfupeng
 */

export default {
    // 粘贴过滤样式，默认开启
    pasteFilterStyle: true,

    // 粘贴内容时，忽略图片。默认关闭
    pasteIgnoreImg: false,

    // 对粘贴的文字进行自定义处理，返回处理后的结果。编辑器会将处理后的结果粘贴到编辑区域中。
    // IE 暂时不支持
    pasteTextHandle: function (content: string): string {
        // content 即粘贴过来的内容（html 或 纯文本），可进行自定义处理然后返回
        return content
    },
}
