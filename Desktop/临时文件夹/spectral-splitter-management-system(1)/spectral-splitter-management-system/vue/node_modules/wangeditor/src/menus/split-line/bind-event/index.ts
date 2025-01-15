/**
 * @description 绑定分割线元素的事件入口
 * @author wangqiaoling
 */
import Editor from '../../../editor/index'
import bindTooltipEvent from './tooltip-event'
/**
 * 绑定事件
 * @param editor 编辑器实例
 */
function bindEvent(editor: Editor) {
    // 分割线的 tooltip 事件
    bindTooltipEvent(editor)
}

export default bindEvent
