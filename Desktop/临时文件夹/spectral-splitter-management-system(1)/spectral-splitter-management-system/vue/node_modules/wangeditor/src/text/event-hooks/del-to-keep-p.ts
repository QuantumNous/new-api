/**
 * @description 删除时保留 EMPTY_P
 * @author wangfupeng
 */

import { EMPTY_P } from '../../utils/const'
import Editor from '../../editor/index'
import $ from '../../utils/dom-core'

/**
 * 删除时保留 EMPTY_P
 * @param editor 编辑器实例
 * @param deleteUpEvents delete 键 up 时的 hooks
 * @param deleteDownEvents delete 建 down 时的 hooks
 */
function deleteToKeepP(editor: Editor, deleteUpEvents: Function[], deleteDownEvents: Function[]) {
    function upFn() {
        const $textElem = editor.$textElem
        const html = editor.$textElem.html()
        const text = editor.$textElem.text()
        const txtHtml = html.trim()
        /**
          @description 
            如果编辑区清空的状态下，单单插入一张图片，删除图片后，会存在空的情况：'<p data-we-empty-p=""></p>'
            需要包含这种边界情况
        **/

        const emptyTags: string[] = ['<p><br></p>', '<br>', '<p data-we-empty-p=""></p>', EMPTY_P]

        // 编辑器中的字符是""或空白，说明内容为空
        if (/^\s*$/.test(text) && (!txtHtml || emptyTags.includes(txtHtml))) {
            // 内容空了
            $textElem.html(EMPTY_P)

            /**
             * 当编辑器 - 文本区内容为空的情况下，会插入一个空的P，此时应该将选区移动到这个空标签上，重置选区
             * bug: 如果选区没有从$textElem上调整到p上，就会有问题，在清空内容，设置标题时，会报错。
             */
            const containerElem = $textElem.getNode()

            // 设置新的选区
            editor.selection.createRangeByElems(
                containerElem.childNodes[0],
                containerElem.childNodes[0]
            )

            const $selectionElem = editor.selection.getSelectionContainerElem()!

            editor.selection.restoreSelection()

            // 设置折叠后的光标位置，在firebox等浏览器下
            // 光标设置在end位置会自动换行
            editor.selection.moveCursor($selectionElem.getNode(), 0)
        }
    }
    deleteUpEvents.push(upFn)

    function downFn(e: Event) {
        const $textElem = editor.$textElem
        const txtHtml = $textElem.html().toLowerCase().trim()
        if (txtHtml === EMPTY_P) {
            // 最后剩下一个空行，就不再删除了
            e.preventDefault()
            return
        }
    }
    deleteDownEvents.push(downFn)
}

/**
 * 剪切时保留 EMPTY_P
 * @param editor 编辑器实例
 * @param cutEvents keydown hooks
 */
export function cutToKeepP(editor: Editor, cutEvents: Function[]) {
    function upFn(e: KeyboardEvent) {
        if (e.keyCode !== 88) {
            return
        }

        const $textElem = editor.$textElem
        const txtHtml = $textElem.html().toLowerCase().trim()

        // firefox 时用 txtHtml === '<br>' 判断，其他用 !txtHtml 判断
        if (!txtHtml || txtHtml === '<br>') {
            // 内容空了
            const $p = $(EMPTY_P)
            $textElem.html(' ') // 一定要先清空，否则在 firefox 下有问题
            $textElem.append($p)
            editor.selection.createRangeByElem($p, false, true)
            editor.selection.restoreSelection()
            // 设置折叠后的光标位置，在firebox等浏览器下
            // 光标设置在end位置会自动换行
            editor.selection.moveCursor($p.getNode(), 0)
        }
    }

    cutEvents.push(upFn)
}

export default deleteToKeepP
