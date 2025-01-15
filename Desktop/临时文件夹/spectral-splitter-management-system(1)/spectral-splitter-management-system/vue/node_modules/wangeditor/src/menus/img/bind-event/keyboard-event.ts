import Editor from '../../../editor'

export default function bindEventKeyboardEvent(editor: Editor) {
    const { txt, selection } = editor
    const { keydownEvents } = txt.eventHooks

    keydownEvents.push(function (e) {
        // 删除图片时，有时会因为浏览器bug删不掉。因此这里手动判断光标前面是不是图片，是就删掉
        const $selectionContainerElem = selection.getSelectionContainerElem()
        const range = selection.getRange()

        if (
            !range ||
            !$selectionContainerElem ||
            e.keyCode !== 8 ||
            !selection.isSelectionEmpty()
        ) {
            return
        }
        let { startContainer, startOffset } = range

        // 同一段落内上一个节点
        let prevNode: Node | null = null
        if (startOffset === 0) {
            // 此时上一个节点需要通过previousSibling去找
            while (
                startContainer !== $selectionContainerElem.elems[0] &&
                $selectionContainerElem.elems[0].contains(startContainer) &&
                startContainer.parentNode &&
                !prevNode
            ) {
                if (startContainer.previousSibling) {
                    prevNode = startContainer.previousSibling as Node
                    break
                }
                startContainer = startContainer.parentNode
            }
        } else if (startContainer.nodeType !== 3) {
            // 非文本节点才需要被处理，比如p
            prevNode = startContainer.childNodes[startOffset - 1]
        }

        if (!prevNode) {
            return
        }

        let lastChildNodeInPrevNode = prevNode

        // 找到最右侧叶子节点
        while (lastChildNodeInPrevNode.childNodes.length) {
            lastChildNodeInPrevNode =
                lastChildNodeInPrevNode.childNodes[lastChildNodeInPrevNode.childNodes.length - 1]
        }

        if (
            lastChildNodeInPrevNode instanceof HTMLElement &&
            lastChildNodeInPrevNode.tagName === 'IMG'
        ) {
            lastChildNodeInPrevNode.remove()
            e.preventDefault()
        }
    })
}
