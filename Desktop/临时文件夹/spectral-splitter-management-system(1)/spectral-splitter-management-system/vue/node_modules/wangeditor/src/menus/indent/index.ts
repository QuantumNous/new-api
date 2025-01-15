/**
 * @description 增加缩进/减少缩进
 * @author tonghan
 */

import $ from '../../utils/dom-core'
import Editor from '../../editor/index'
import DropListMenu from '../menu-constructors/DropListMenu'
import { MenuActive } from '../menu-constructors/Menu'
import operateElement from './operate-element'

class Indent extends DropListMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="缩进">
                <i class="w-e-icon-indent-increase"></i>
            </div>`
        )
        const dropListConf = {
            width: 130,
            title: '设置缩进',
            type: 'list',
            list: [
                {
                    $elem: $(
                        `<p>
                            <i class="w-e-icon-indent-increase w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.indent.增加缩进')}
                        <p>`
                    ),
                    value: 'increase',
                },

                {
                    $elem: $(
                        `<p>
                            <i class="w-e-icon-indent-decrease w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.indent.减少缩进')}
                        <p>`
                    ),
                    value: 'decrease',
                },
            ],
            clickHandler: (value: string) => {
                // 注意 this 是指向当前的 Indent 对象
                this.command(value)
            },
        }

        super($elem, editor, dropListConf)
    }

    /**
     * 执行命令
     * @param value value
     */
    public command(value: string): void {
        const editor = this.editor
        const $selectionElem = editor.selection.getSelectionContainerElem()

        // 判断 当前选区为 textElem 时
        if ($selectionElem && editor.$textElem.equal($selectionElem)) {
            // 当 当前选区 等于 textElem 时
            // 代表 当前选区 可能是一个选择了一个完整的段落或者多个段落
            const $elems = editor.selection.getSelectionRangeTopNodes()
            if ($elems.length > 0) {
                $elems.forEach((item: any) => {
                    operateElement($(item), value, editor)
                })
            }
        } else {
            // 当 当前选区 不等于 textElem 时
            // 代表 当前选区要么是一个段落，要么是段落中的一部分
            if ($selectionElem && $selectionElem.length > 0) {
                $selectionElem.forEach((item: any) => {
                    operateElement($(item), value, editor)
                })
            }
        }

        // 恢复选区
        editor.selection.restoreSelection()
        this.tryChangeActive()
    }

    /**
     * 尝试改变菜单激活（高亮）状态
     */
    public tryChangeActive(): void {
        const editor = this.editor
        const $selectionElem = editor.selection.getSelectionStartElem()
        const $selectionStartElem = $($selectionElem).getNodeTop(editor)

        if ($selectionStartElem.length <= 0) return

        if ($selectionStartElem.elems[0].style['paddingLeft'] != '') {
            this.active()
        } else {
            this.unActive()
        }
    }
}

export default Indent
