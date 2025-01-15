/**
 * @description 图片点击后选区更新到img的位置
 * @author tonghan
 */

import Editor from '../../editor/index'
import { DomElement } from '../../utils/dom-core'

/**
 * 图片点击后选区更新到img的位置
 * @param editor 编辑器实例
 * @param imgClickEvents delete 键 up 时的 hooks
 */
function imgClickActive(editor: Editor, imgClickEvents: Function[]) {
    function clickFn($img: DomElement) {
        editor.selection.createRangeByElem($img)
        editor.selection.restoreSelection()
    }
    imgClickEvents.push(clickFn)
}

export default imgClickActive
