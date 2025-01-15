/**
 * @description 兼容火狐浏览器内核有video标签时光标定位不对问题
 * @author yanbiao(86driver)
 */
import Editor from '../../../editor/index'
import { UA } from '../../../utils/util'

export default function bindEventKeyboardEvent(editor: Editor) {
    if (!UA.isFirefox) return
    const { txt, selection } = editor
    const { keydownEvents } = txt.eventHooks

    keydownEvents.push(function (e) {
        // 实时保存选区
        // editor.selection.saveRange()
        const $selectionContainerElem = selection.getSelectionContainerElem()
        if ($selectionContainerElem) {
            const $topElem = $selectionContainerElem.getNodeTop(editor)
            const $preElem = $topElem.length
                ? $topElem.prev().length
                    ? $topElem.prev()
                    : null
                : null
            if ($preElem && $preElem.attr('data-we-video-p')) {
                // 光标处于选区开头
                if (selection.getCursorPos() === 0) {
                    // 如果上一个dom是包含video， 按下删除连video一块删除
                    if (e.keyCode === 8) {
                        $preElem.remove()
                    }
                }
            }
        }
    })
}
