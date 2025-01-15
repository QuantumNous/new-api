/**
 * @description 初始化编辑器选区，将光标定位到文档末尾
 * @author wangfupeng
 */

import Editor from '../index'
import $ from '../../utils/dom-core'
import { EMPTY_P } from '../../utils/const'

/**
 * 初始化编辑器选区，将光标定位到文档末尾
 * @param editor 编辑器实例
 * @param newLine 是否新增一行
 */
function initSelection(editor: Editor, newLine?: boolean) {
    const $textElem = editor.$textElem
    const $children = $textElem.children()
    if (!$children || !$children.length) {
        // 如果编辑器区域无内容，添加一个空行，重新设置选区
        $textElem.append($(EMPTY_P))
        initSelection(editor)
        return
    }

    const $last = $children.last()

    if (newLine) {
        // 新增一个空行
        const html = $last.html().toLowerCase()
        const nodeName = $last.getNodeName()
        if ((html !== '<br>' && html !== '<br/>') || nodeName !== 'P') {
            // 最后一个元素不是 空标签，添加一个空行，重新设置选区
            $textElem.append($(EMPTY_P))
            initSelection(editor)
            return
        }
    }

    editor.selection.createRangeByElem($last, false, true)
    if (editor.config.focus) {
        editor.selection.restoreSelection()
    } else {
        // 防止focus=false受其他因素影响
        editor.selection.clearWindowSelectionRange()
    }
}

export default initSelection
