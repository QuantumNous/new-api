import $, { DomElement } from '../../utils/dom-core'

/**
 * 创建一个blockquote元素节点
 * @param editor 编辑器实例
 */
function createQuote($childElem: DomElement[]): DomElement {
    const $targetElem = $(`<blockquote></blockquote>`)
    $childElem.forEach(node => {
        $targetElem.append(node.clone(true))
    })
    return $targetElem
}

export default createQuote
