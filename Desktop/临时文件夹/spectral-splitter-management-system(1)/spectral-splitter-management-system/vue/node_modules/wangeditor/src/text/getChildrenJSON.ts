/**
 * @description 获取子元素的 JSON 格式数据
 * @author wangfupeng
 */

import { replaceHtmlSymbol } from '../utils/util'
import $, { DomElement } from '../utils/dom-core'

type AttrType = {
    name: string
    value: string
}
export type NodeType = {
    tag: string
    attrs: AttrType[]
    children: NodeListType
}
export type NodeListType = Array<string | NodeType>

/**
 * 获取子元素的 JSON 格式数据
 * @param $elem DOM 节点
 */
function getChildrenJSON($elem: DomElement): NodeListType {
    const result: NodeListType = [] // 存储结果

    const $children = $elem.childNodes() || [] // 注意 childNodes() 可以获取文本节点
    $children.forEach((curElem: HTMLElement) => {
        let elemResult
        const nodeType = curElem.nodeType

        // 文本节点
        if (nodeType === 3) {
            elemResult = curElem.textContent || ''
            elemResult = replaceHtmlSymbol(elemResult)
        }

        // 普通 DOM 节点
        if (nodeType === 1) {
            elemResult = {}
            elemResult = elemResult as NodeType

            // tag
            elemResult.tag = curElem.nodeName.toLowerCase()
            // attr
            const attrData = []
            const attrList = curElem.attributes
            const attrListLength = attrList.length || 0
            for (let i = 0; i < attrListLength; i++) {
                const attr = attrList[i]
                attrData.push({
                    name: attr.name,
                    value: attr.value,
                })
            }
            elemResult.attrs = attrData
            // children（递归）
            elemResult.children = getChildrenJSON($(curElem))
        }

        if (elemResult) {
            result.push(elemResult)
        }
    })
    return result
}

export default getChildrenJSON
