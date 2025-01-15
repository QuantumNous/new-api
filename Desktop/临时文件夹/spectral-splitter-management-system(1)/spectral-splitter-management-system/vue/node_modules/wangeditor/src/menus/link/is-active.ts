/**
 * @description 检查选区是否在链接中，即菜单是否应该 active
 * @author wangfupeng
 */

import Editor from '../../editor/index'
import { DomElement } from '../../utils/dom-core'

// 加粗 b
// 字号/字体/颜色 font
// 斜体 i
// 删除线 strike
export const EXTRA_TAG = ['B', 'FONT', 'I', 'STRIKE']

export function getParentNodeA(selectionELem: DomElement) {
    let node = selectionELem.elems[0]

    while (node && EXTRA_TAG.includes(node.nodeName)) {
        node = node.parentElement!

        if (node.nodeName === 'A') {
            return node
        }
    }
}

function isActive(editor: Editor) {
    const $selectionELem = editor.selection.getSelectionContainerElem()

    if (!$selectionELem?.elems?.length) {
        return false
    }

    // 选中直接是a元素
    if ($selectionELem.getNodeName() === 'A') {
        return true
    }

    // 有可能a里面嵌套了其他元素，比如b、i元素等
    const parentNode = getParentNodeA($selectionELem)

    if (parentNode && parentNode.nodeName === 'A') {
        return true
    }

    return false
}

export default isActive
