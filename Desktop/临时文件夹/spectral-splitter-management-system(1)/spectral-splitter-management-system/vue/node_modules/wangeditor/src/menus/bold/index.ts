/**
 * @description 加粗
 * @author wangfupeng
 */

import BtnMenu from '../menu-constructors/BtnMenu'
import $ from '../../utils/dom-core'
import Editor from '../../editor/index'
import { MenuActive } from '../menu-constructors/Menu'

class Bold extends BtnMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="加粗">
                <i class="w-e-icon-bold"></i>
            </div>`
        )
        super($elem, editor)
    }

    /**
     * 点击事件
     */
    public clickHandler(): void {
        const editor = this.editor
        const isSelectEmpty = editor.selection.isSelectionEmpty()

        if (isSelectEmpty) {
            // 选区范围是空的，插入并选中一个“空白”
            editor.selection.createEmptyRange()
        }

        // 执行 bold 命令
        editor.cmd.do('bold')

        if (isSelectEmpty) {
            // 需要将选区范围折叠起来
            editor.selection.collapseRange()
            editor.selection.restoreSelection()
        }
    }

    /**
     * 尝试修改菜单激活状态
     */
    public tryChangeActive(): void {
        const editor = this.editor
        if (editor.cmd.queryCommandState('bold')) {
            this.active()
        } else {
            this.unActive()
        }
    }
}

export default Bold
