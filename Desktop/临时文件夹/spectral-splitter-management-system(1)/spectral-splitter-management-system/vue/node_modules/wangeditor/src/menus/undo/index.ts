/**
 * @description 撤销
 * @author tonghan
 */

import $ from '../../utils/dom-core'
import Editor from '../../editor/index'
import BtnMenu from '../menu-constructors/BtnMenu'
import { MenuActive } from '../menu-constructors/Menu'

class Undo extends BtnMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="撤销">
                <i class="w-e-icon-undo"></i>
            </div>`
        )
        super($elem, editor)
    }

    /**
     * 点击事件
     */
    public clickHandler(): void {
        const editor = this.editor
        editor.history.revoke()

        // 重新创建 range，是处理当初始化编辑器，API插入内容后撤销，range 不在编辑器内部的问题
        const children = editor.$textElem.children()

        if (!children?.length) return

        const $last = children.last()
        editor.selection.createRangeByElem($last, false, true)
        editor.selection.restoreSelection()
    }

    /**
     * 尝试修改菜单激活状态
     */
    public tryChangeActive(): void {
        // 标准模式下才进行操作
        if (!this.editor.isCompatibleMode) {
            if (this.editor.history.size[0]) {
                this.active()
            } else {
                this.unActive()
            }
        }
    }
}

export default Undo
