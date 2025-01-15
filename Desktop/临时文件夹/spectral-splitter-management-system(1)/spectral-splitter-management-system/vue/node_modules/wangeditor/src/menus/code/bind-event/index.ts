/**
 * @description 绑定链接元素的事件，入口
 * @author lkw
 */

import Editor from '../../../editor/index'
import bindTooltipEvent from './tooltip-event'
import bindEventJumpCodeBlock from './jump-code-block-down'

/**
 * 绑定事件
 * @param editor 编辑器实例
 */
function bindEvent(editor: Editor) {
    // tooltip 事件
    bindTooltipEvent(editor)

    // 代码块为最后内容的跳出处理
    bindEventJumpCodeBlock(editor)
}

export default bindEvent
