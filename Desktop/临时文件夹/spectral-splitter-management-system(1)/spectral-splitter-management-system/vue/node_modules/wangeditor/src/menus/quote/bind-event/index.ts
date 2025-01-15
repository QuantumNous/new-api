import { EMPTY_P } from '../../../utils/const'
import Editor from '../../../editor/index'
import $, { DomElement } from '../../../utils/dom-core'
function bindEvent(editor: Editor) {
    function quoteEnter(e: Event) {
        const $selectElem = editor.selection.getSelectionContainerElem() as DomElement
        const $topSelectElem = editor.selection.getSelectionRangeTopNodes()[0]
        // 对quote的enter进行特殊处理
        //最后一行为空标签时再按会出跳出blockquote
        if ($topSelectElem?.getNodeName() === 'BLOCKQUOTE') {
            // firefox下点击引用按钮会选中外容器<blockquote></blockquote>
            if ($selectElem.getNodeName() === 'BLOCKQUOTE') {
                const selectNode = $selectElem.childNodes()?.getNode() as Node
                editor.selection.moveCursor(selectNode)
            }
            if ($selectElem.text() === '') {
                e.preventDefault()
                $selectElem.remove()
                const $newLine = $(EMPTY_P)
                $newLine.insertAfter($topSelectElem)
                // 将光标移动br前面
                editor.selection.moveCursor($newLine.getNode(), 0)
            }

            // 当blockQuote中没有内容回车后移除blockquote
            if ($topSelectElem.text() === '') {
                $topSelectElem.remove()
            }
        }
    }
    editor.txt.eventHooks.enterDownEvents.push(quoteEnter)
}

export default bindEvent
