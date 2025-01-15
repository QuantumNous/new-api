import Editor from '../../../editor/index'
import $ from '../../../utils/dom-core'
import { getCursorNextNode, isAllTodo } from '../util'
import createTodo from '../todo'
import { dealTextNode, isTodo } from '../util'
import { EMPTY_P } from '../../../utils/const'

/**
 * todolist 内部逻辑
 * @param editor
 */
function bindEvent(editor: Editor) {
    /**
     * todo的自定义回车事件
     * @param e 事件属性
     */
    function todoEnter(e: Event) {
        // 判断是否为todo节点
        if (isAllTodo(editor)) {
            e.preventDefault()
            const selection = editor.selection
            const $topSelectElem = selection.getSelectionRangeTopNodes()[0]
            const $li = $topSelectElem.childNodes()?.get(0)
            const selectionNode = window.getSelection()?.anchorNode as Node
            const range = selection.getRange()

            if (!range?.collapsed) {
                const rangeChildNodes = range?.commonAncestorContainer.childNodes
                const startContainer = range?.startContainer as Node
                const endContainer = range?.endContainer as Node
                const startPos = range?.startOffset as number
                const endPos = range?.endOffset as number
                let startElemIndex: number = 0
                let endElemIndex: number = 0
                let delList: ChildNode[] = []
                // 找出startContainer和endContainer在rangeChildNodes中的位置
                rangeChildNodes?.forEach((v, i) => {
                    if (v.contains(startContainer)) startElemIndex = i
                    if (v.contains(endContainer)) endElemIndex = i
                })
                // 删除两个容器间的内容
                if (endElemIndex - startElemIndex > 1) {
                    rangeChildNodes?.forEach((v, i) => {
                        if (i <= startElemIndex) return
                        if (i >= endElemIndex) return
                        delList.push(v)
                    })
                    delList.forEach(v => {
                        v.remove()
                    })
                }
                // 删除两个容器里拖蓝的内容
                dealTextNode(startContainer, startPos)
                dealTextNode(endContainer, endPos, false)
                editor.selection.moveCursor(endContainer, 0)
            }

            // 回车时内容为空时，删去此行
            if ($topSelectElem.text() === '') {
                const $p = $(EMPTY_P)
                $p.insertAfter($topSelectElem)
                selection.moveCursor($p.getNode())
                $topSelectElem.remove()
                return
            }

            const pos = selection.getCursorPos() as number
            const CursorNextNode = getCursorNextNode($li?.getNode() as Node, selectionNode, pos)
            const todo = createTodo($(CursorNextNode))
            const $inputcontainer = todo.getInputContainer()
            const todoLiElem = $inputcontainer.parent().getNode()
            const $newTodo = todo.getTodo()
            const contentSection = $inputcontainer.getNode().nextSibling
            // 处理光标在最前面时回车input不显示的问题
            if ($li?.text() === '') {
                $li?.append($(`<br>`))
            }
            $newTodo.insertAfter($topSelectElem)
            // 处理在google中光标在最后面的，input不显示的问题(必须插入之后移动光标)
            if (!contentSection || contentSection?.textContent === '') {
                // 防止多个br出现的情况
                if (contentSection?.nodeName !== 'BR') {
                    const $br = $(`<br>`)
                    $br.insertAfter($inputcontainer)
                }
                selection.moveCursor(todoLiElem, 1)
            } else {
                selection.moveCursor(todoLiElem)
            }
        }
    }

    /**
     * 自定义删除事件，用来处理光标在最前面删除input产生的问题
     */
    function delDown(e: Event) {
        if (isAllTodo(editor)) {
            const selection = editor.selection
            const $topSelectElem = selection.getSelectionRangeTopNodes()[0]
            const $li = $topSelectElem.childNodes()?.getNode()
            const $p = $(`<p></p>`)
            const p = $p.getNode()
            const selectionNode = window.getSelection()?.anchorNode as Node
            const pos = selection.getCursorPos()
            const prevNode = selectionNode.previousSibling

            // 处理内容为空的情况
            if ($topSelectElem.text() === '') {
                e.preventDefault()
                const $newP = $(EMPTY_P)
                $newP.insertAfter($topSelectElem)
                $topSelectElem.remove()
                selection.moveCursor($newP.getNode(), 0)
                return
            }

            // 处理有内容时，光标在最前面的情况
            if (
                prevNode?.nodeName === 'SPAN' &&
                prevNode.childNodes[0].nodeName === 'INPUT' &&
                pos === 0
            ) {
                e.preventDefault()
                $li?.childNodes.forEach((v, index) => {
                    if (index === 0) return
                    p.appendChild(v.cloneNode(true))
                })
                $p.insertAfter($topSelectElem)

                $topSelectElem.remove()
            }
        }
    }

    /**
     * 自定义删除键up事件
     */
    function deleteUp() {
        const selection = editor.selection
        const $topSelectElem = selection.getSelectionRangeTopNodes()[0]
        if ($topSelectElem && isTodo($topSelectElem)) {
            if ($topSelectElem.text() === '') {
                $(EMPTY_P).insertAfter($topSelectElem)
                $topSelectElem.remove()
            }
        }
    }

    /**
     * input 的点击事件（ input 默认不会产生 attribute 的改变 ）
     * @param e 事件属性
     */
    function inputClick(e?: Event): void {
        if (e && e.target instanceof HTMLInputElement) {
            if (e.target.type === 'checkbox') {
                if (e.target.checked) {
                    e.target.setAttribute('checked', 'true')
                } else {
                    e.target.removeAttribute('checked')
                }
            }
        }
    }

    editor.txt.eventHooks.enterDownEvents.push(todoEnter)
    editor.txt.eventHooks.deleteUpEvents.push(deleteUp)
    editor.txt.eventHooks.deleteDownEvents.push(delDown)
    editor.txt.eventHooks.clickEvents.push(inputClick)
}

export default bindEvent
