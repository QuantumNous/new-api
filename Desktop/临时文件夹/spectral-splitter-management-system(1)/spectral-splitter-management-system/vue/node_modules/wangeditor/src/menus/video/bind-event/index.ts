/**
 * @description 绑定视频的事件
 * @author lichunlin
 */

import Editor from '../../../editor/index'
import bindTooltipVideo from './tooltip-event'
import bindEventKeyboardEvent from './keyboard'

/**
 * 绑定事件
 * @param editor 编辑器实例
 */
function bindEvent(editor: Editor): void {
    //Tooltip
    bindTooltipVideo(editor)
    bindEventKeyboardEvent(editor)
}

export default bindEvent
