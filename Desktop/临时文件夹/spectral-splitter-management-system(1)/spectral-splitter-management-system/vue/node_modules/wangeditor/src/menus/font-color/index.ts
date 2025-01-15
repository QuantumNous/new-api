/**
 * @description 文字颜色 FontColor
 * @author lkw
 *
 */

import DropListMenu from '../menu-constructors/DropListMenu'
import $ from '../../utils/dom-core'
import Editor from '../../editor/index'
import { MenuActive } from '../menu-constructors/Menu'

class FontColor extends DropListMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="文字颜色">
                <i class="w-e-icon-pencil2"></i>
            </div>`
        )
        const colorListConf = {
            width: 120,
            title: '文字颜色',
            // droplist 内容以 block 形式展示
            type: 'inline-block',
            list: editor.config.colors.map(color => {
                return {
                    $elem: $(`<i style="color:${color};" class="w-e-icon-pencil2"></i>`),
                    value: color,
                }
            }),
            clickHandler: (value: string) => {
                // this 是指向当前的 BackColor 对象
                this.command(value)
            },
        }
        super($elem, editor, colorListConf)
    }

    /**
     * 执行命令
     * @param value value
     */
    public command(value: string): void {
        const editor = this.editor
        const isEmptySelection = editor.selection.isSelectionEmpty()
        const $selectionElem = editor.selection.getSelectionContainerElem()?.elems[0]

        if ($selectionElem == null) return

        // 获取选区范围的文字
        const $selectionText = editor.selection.getSelectionText()
        // 如果设置的是 a 标签就特殊处理一下，避免回车换行设置颜色无效的情况
        // 只处理选中a标签内全部文字的情况，因为选中部分文字不存在换行颜色失效的情况
        if ($selectionElem.nodeName === 'A' && $selectionElem.textContent === $selectionText) {
            // 创建一个相当于占位的元素
            const _payloadElem = $('<span>&#8203;</span>').getNode()
            // 添加到a标签之后
            $selectionElem.appendChild(_payloadElem)
        }
        editor.cmd.do('foreColor', value)

        if (isEmptySelection) {
            // 需要将选区范围折叠起来
            editor.selection.collapseRange()
            editor.selection.restoreSelection()
        }
    }

    /**
     * 尝试修改菜单激活状态
     */
    public tryChangeActive(): void {}
}

export default FontColor
