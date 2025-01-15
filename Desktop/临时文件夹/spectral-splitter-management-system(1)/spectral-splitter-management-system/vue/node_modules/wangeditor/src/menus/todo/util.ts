import { DomElement } from '../../utils/dom-core'
import Editor from '../../editor'

/**
 * 判断传入的单行顶级选区选取是不是todo
 * @param editor 编辑器对象
 */
function isTodo($topSelectElem: DomElement) {
    if ($topSelectElem.length) {
        return $topSelectElem.attr('class') === 'w-e-todo'
    }

    return false
}
/**
 * 判断选中的内容是不是都是todo
 * @param editor 编辑器对象
 */
function isAllTodo(editor: Editor): boolean | undefined {
    const $topSelectElems = editor.selection.getSelectionRangeTopNodes()
    // 排除为[]的情况
    if ($topSelectElems.length === 0) return

    return $topSelectElems.every($topSelectElem => {
        return isTodo($topSelectElem)
    })
}

/**
 * 根据所在的文本节点和光标在文本节点的位置获取截断的后节点内容
 * @param node 顶级节点
 * @param textNode 光标所在的文本节点
 * @param pos 光标在文本节点的位置
 */
function getCursorNextNode(node: Node, textNode: Node, pos: number): Node | undefined {
    if (!node.hasChildNodes()) return

    const newNode = node.cloneNode() as ChildNode
    // 判断光标是否在末尾
    let end = false
    if (textNode.nodeValue === '') {
        end = true
    }

    let delArr: Node[] = []
    node.childNodes.forEach(v => {
        //光标后的内容
        if (!isContains(v, textNode) && end) {
            newNode.appendChild(v.cloneNode(true))
            if (v.nodeName !== 'BR') {
                delArr.push(v)
            }
        }
        // 光标所在的区域
        if (isContains(v, textNode)) {
            if (v.nodeType === 1) {
                const childNode = getCursorNextNode(v, textNode, pos) as Node
                if (childNode && childNode.textContent !== '') newNode?.appendChild(childNode)
            }
            if (v.nodeType === 3) {
                if (textNode.isEqualNode(v)) {
                    const textContent = dealTextNode(v, pos)
                    newNode.textContent = textContent
                }
            }
            end = true
        }
    })
    // 删除选中后原来的节点
    delArr.forEach(v => {
        const node = v as ChildNode
        node.remove()
    })

    return newNode
}

/**
 * 判断otherNode是否包含在node中
 * @param node 父节点
 * @param otherNode 需要判断是不是被包含的节点
 */
function isContains(node: Node, otherNode: Node) {
    // 兼容ie11中textNode不支持contains方法
    if (node.nodeType === 3) {
        return node.nodeValue === otherNode.nodeValue
    }

    return node.contains(otherNode)
}
/**
 * 获取新的文本节点
 * @param node 要处理的文本节点
 * @param pos  光标在文本节点所在的位置
 * @param start 设置为true时保留开始位置到光标的内容，设置为false时删去开始的内容
 */
function dealTextNode(node: Node, pos: number, start: boolean = true): string {
    let content = node.nodeValue
    let oldContent = content?.slice(0, pos) as string
    content = content?.slice(pos) as string
    // start为false时替换content和oldContent
    if (!start) {
        let temp = content
        content = oldContent
        oldContent = temp
    }
    node.nodeValue = oldContent
    return content
}

export { getCursorNextNode, isTodo, isAllTodo, dealTextNode }
