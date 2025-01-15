/**
 * @description 视频布局 事件
 * @author lichunlin
 */

import $, { DomElement } from '../../../utils/dom-core'

// 设置布局方式
export default function setAlignment($node: DomElement, value: string) {
    // 设置顶级元素匹配
    const NODENAME = ['P']
    // 获取匹配得顶级元素
    const topNode = getSelectedTopNode($node, NODENAME)
    // 判断是否存在
    if (topNode) {
        $(topNode).css('text-align', value)
    }
}

/**
 * 获取选中的元素的顶级元素
 * @params el 选中的元素
 * @params tag 匹配顶级的元素 如 P LI ....
 */
function getSelectedTopNode(el: DomElement, tag: string[]): Node | null {
    let parentNode: Node | null = el.elems[0]
    // 可能出现嵌套的情况，所以一级一级向上找，找到指定得顶级元素
    while (parentNode != null) {
        if (tag.includes(parentNode?.nodeName)) {
            return parentNode
        }
        // 兜底 body
        if (parentNode?.parentNode?.nodeName === 'BODY') {
            return null
        }
        parentNode = parentNode.parentNode
    }
    return parentNode
}
