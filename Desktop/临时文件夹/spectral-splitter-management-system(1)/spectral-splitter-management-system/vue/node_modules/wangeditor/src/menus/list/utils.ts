import { ListType } from '.'
import Editor from '../../editor/index'
import $, { DomElement } from '../../utils/dom-core'
import { ContainerFragment } from './ListHandle'

/**
 * 过滤 选择的 node 节点
 * @returns { DomElement[] } DomElement[]
 */
export function filterSelectionNodes($nodes: DomElement[]): DomElement[] {
    const $listHtml: DomElement[] = []
    $nodes.forEach(($node: DomElement) => {
        const targerName = $node.getNodeName()
        if (targerName !== ListType.OrderedList && targerName !== ListType.UnorderedList) {
            // 非序列
            $listHtml.push($node)
        } else {
            // 序列
            if ($node.prior) {
                $listHtml.push($node.prior)
            } else {
                const $children = $node.children()
                $children?.forEach(($li: HTMLElement) => {
                    $listHtml.push($($li))
                })
            }
        }
    })

    return $listHtml
}

/**
 * 更新选区
 * @param $node
 */

export function updateRange(editor: Editor, $node: DomElement, collapsed: boolean) {
    const selection = editor.selection
    const range = document.createRange()

    // ===============================
    // length 大于 1
    // 代表着转换是一个文档节点多段落
    // ===============================
    if ($node.length > 1) {
        range.setStart($node.elems[0], 0)
        range.setEnd($node.elems[$node.length - 1], $node.elems[$node.length - 1].childNodes.length)
    }

    // ===============================
    // 序列节点 或 单段落
    // ===============================
    else {
        range.selectNodeContents($node.elems[0])
    }

    // ===============================
    // collapsed 为 true 代表是光标
    // ===============================
    collapsed && range.collapse(false)
    selection.saveRange(range)
    selection.restoreSelection()
}

/**
 * 获取起点元素
 * @param $startElem 开始序列节点
 */
export function getStartPoint($startElem: DomElement): DomElement {
    return $startElem.prior
        ? $startElem.prior // 有 prior 代表不是全选序列
        : $($startElem.children()?.elems[0]) // 没有则代表全选序列
}

/**
 * 获取结束元素
 * @param $endElem 结束序列节点
 */
export function getEndPoint($endElem: DomElement): DomElement {
    return $endElem.prior
        ? $endElem.prior // 有 prior 代表不是全选序列
        : $($endElem.children()?.last().elems[0]) // 没有则代表全选序列
}

/**
 * 在您指定节点的已有子节点之前插入新的子节点。
 * @param { DomElement } $node 指定节点
 * @param { ContainerFragment } newNode 插入的新子节点
 * @param { Node | null } existingNode 指定子节点
 */
export function insertBefore(
    $node: DomElement,
    newNode: ContainerFragment,
    existingNode: Node | null = null
) {
    $node.parent().elems[0].insertBefore(newNode, existingNode)
}

/**
 * 创建指定的 element 对象
 */
export function createElement(target: string): HTMLElement {
    return document.createElement(target)
}

/**
 * 创建文档片段
 */
export function createDocumentFragment(): DocumentFragment {
    return document.createDocumentFragment()
}

/**
 * 生成 li 标签的元素，并返回 $fragment 文档片段
 * @param { DomElement[] } $nodes 需要转换成 li 的 dom 元素数组
 * @param { ContainerFragment } $fragment 用于存储生成后 li 元素的文档片段
 */
export function createElementFragment(
    $nodes: DomElement[],
    $fragment: ContainerFragment,
    tag: string = 'li'
): ContainerFragment {
    $nodes.forEach(($node: DomElement) => {
        const $list = createElement(tag)
        $list.innerHTML = $node.html()
        $fragment.appendChild($list)
        $node.remove()
    })
    return $fragment
}
