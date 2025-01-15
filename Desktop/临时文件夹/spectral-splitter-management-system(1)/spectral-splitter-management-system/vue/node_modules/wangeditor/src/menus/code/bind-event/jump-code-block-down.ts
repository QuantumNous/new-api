/**
 * @description 代码块为最后一块内容时往下跳出代码块
 * @author zhengwenjian
 */
import { EMPTY_P } from '../../../utils/const'
import Editor from '../../../editor/index'
import $ from '../../../utils/dom-core'

/**
 * 在代码块最后一行 按方向下键跳出代码块的处理
 * @param editor 编辑器实例
 */
export default function bindEventJumpCodeBlock(editor: Editor) {
    const { $textElem, selection, txt } = editor
    const { keydownEvents } = txt.eventHooks

    keydownEvents.push(function (e) {
        // 40 是键盘中的下方向键
        if (e.keyCode !== 40) return
        const node = selection.getSelectionContainerElem()
        const $lastNode = $textElem.children()?.last()
        if (node?.elems[0].tagName === 'XMP' && $lastNode?.elems[0].tagName === 'PRE') {
            // 就是最后一块是代码块的情况插入空p标签并光标移至p
            const $emptyP = $(EMPTY_P)
            $textElem.append($emptyP)
        }
    })
    // fix: 修复代码块作为最后一个元素时，用户无法再进行输入的问题
    keydownEvents.push(function (e) {
        // 实时保存选区
        editor.selection.saveRange()
        const $selectionContainerElem = selection.getSelectionContainerElem()
        if ($selectionContainerElem) {
            const $topElem = $selectionContainerElem.getNodeTop(editor)
            // 获取选区所在节点的上一元素
            const $preElem = $topElem?.prev()
            // 判断该元素后面是否还存在元素
            // 如果存在则允许删除
            const $nextElem = $topElem?.getNextSibling()

            if ($preElem.length && $preElem?.getNodeName() === 'PRE' && $nextElem.length === 0) {
                // 光标处于选区开头
                if (selection.getCursorPos() === 0) {
                    // 按下delete键时末尾追加空行
                    if (e.keyCode === 8) {
                        const $emptyP = $(EMPTY_P)
                        $textElem.append($emptyP)
                    }
                }
            }
        }
    })
}
