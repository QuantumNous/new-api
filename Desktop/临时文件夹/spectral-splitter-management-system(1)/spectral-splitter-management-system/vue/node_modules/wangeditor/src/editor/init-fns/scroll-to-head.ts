/**
 * @description 滚动到指定锚点
 * @author zhengwenjian
 */

import Editor from '../index'

/**
 * 编辑器滚动到指定锚点
 * @param editor 编辑器实例
 * @param id 标题锚点id
 */
const scrollToHead = (editor: Editor, id: string) => {
    const $textElem = editor.isEnable
        ? editor.$textElem
        : editor.$textContainerElem.find('.w-e-content-mantle')
    const $targetHead = $textElem.find(`[id='${id}']`)
    const targetTop = $targetHead.getOffsetData().top
    $textElem.scrollTop(targetTop)
}

export default scrollToHead
