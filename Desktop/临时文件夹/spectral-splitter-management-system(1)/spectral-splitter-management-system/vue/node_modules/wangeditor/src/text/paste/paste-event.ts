/**
 * @description 处理粘贴逻辑
 * @author wangfupeng
 */

import { replaceHtmlSymbol, forEach } from '../../utils/util'
import parseHtml from './parse-html'

/**
 * 获取粘贴的纯文本
 * @param e Event 参数
 */
export function getPasteText(e: ClipboardEvent): string {
    // const clipboardData = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData)
    const clipboardData = e.clipboardData // 暂不考虑 originalEvent 的情况
    let pasteText = ''
    if (clipboardData == null) {
        pasteText = (window as any).clipboardData && (window as any).clipboardData.getData('text')
    } else {
        pasteText = clipboardData.getData('text/plain')
    }
    return replaceHtmlSymbol(pasteText)
}

/**
 * 获取粘贴的 html 字符串
 * @param e Event 参数
 * @param filterStyle 是否过滤 style 样式
 * @param ignoreImg 是否忽略 img 标签
 */
export function getPasteHtml(
    e: ClipboardEvent,
    filterStyle: boolean = true,
    ignoreImg: boolean = false
): string {
    const clipboardData = e.clipboardData // 暂不考虑 originalEvent 的情况
    let pasteHtml = ''
    if (clipboardData) {
        pasteHtml = clipboardData.getData('text/html')
    }

    // 无法通过 'text/html' 格式获取 html，则尝试获取 text
    if (!pasteHtml) {
        const text = getPasteText(e)
        if (!text) {
            return '' // 没有找到任何文字，则返回
        }
        pasteHtml = `<p>${text}</p>`
    }

    // 转译<1，后面跟数字的转译成 &lt;1
    pasteHtml = pasteHtml.replace(/<(\d)/gm, (_, num) => '&lt;' + num)

    // pdf复制只会有一个meta标签，parseHtml中的过滤meta标签会导致后面内容丢失
    pasteHtml = pasteHtml.replace(/<(\/?meta.*?)>/gim, '')

    // 剔除多余的标签、属性
    pasteHtml = parseHtml(pasteHtml, filterStyle, ignoreImg)

    return pasteHtml
}

/**
 * 获取粘贴的图片文件
 * @param e Event 参数
 */
export function getPasteImgs(e: ClipboardEvent): File[] {
    const result: File[] = []
    const txt = getPasteText(e)
    if (txt) {
        // 有文字，就忽略图片
        return result
    }

    const items = e.clipboardData?.items

    if (!items) return result

    forEach(items, (key, value) => {
        const type = value.type
        if (/image/i.test(type)) {
            result.push(value.getAsFile() as File)
        }
    })

    return result
}
