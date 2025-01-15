/**
 * @description 代码 菜单
 * @author lkw
 */

import PanelMenu from '../menu-constructors/PanelMenu'
import Editor from '../../editor/index'
import $ from '../../utils/dom-core'
import { replaceSpecialSymbol, deepClone } from '../../utils/util'
import createPanelConf from './create-panel-conf'
import isActive from './is-active'
import Panel from '../menu-constructors/Panel'
import { MenuActive } from '../menu-constructors/Menu'
import bindEvent from './bind-event/index'

export function formatCodeHtml(editor: Editor, html: string) {
    if (!html) return html

    html = deleteHighlightCode(html)

    html = formatEnterCode(html)

    html = replaceSpecialSymbol(html)

    return html

    // 格式化换换所产生的code标签
    function formatEnterCode(html: string): string {
        let preArr = html.match(/<pre[\s|\S]+?\/pre>/g)

        if (preArr === null) return html

        preArr.map(item => {
            //将连续的code标签换为\n换行
            html = html.replace(item, item.replace(/<\/code><code>/g, '\n').replace(/<br>/g, ''))
        })

        return html
    }

    // highlight格式化方法
    function deleteHighlightCode(html: string): string {
        // 获取所有hljs文本
        let m = html.match(/<span\sclass="hljs[\s|\S]+?\/span>/gm)

        // 没有代码渲染文本则退出
        // @ts-ignore
        if (!m || !m.length) return html

        // 获取替换文本
        let r = deepClone(m).map((i: string) => {
            i = i.replace(/<span\sclass="hljs[^>]+>/, '')
            return i.replace(/<\/span>/, '')
        })

        // @ts-ignore
        for (let i = 0; i < m.length; i++) {
            html = html.replace(m[i], r[i])
        }

        return deleteHighlightCode(html)
    }
}

class Code extends PanelMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            '<div class="w-e-menu" data-title="代码"><i class="w-e-icon-terminal"></i></div>'
        )
        super($elem, editor)

        // 绑定事件，如点击链接时，可以查看链接
        bindEvent(editor)
    }

    /**
     * 插入行内代码
     * @param text
     * @return null
     */
    private insertLineCode(text: string) {
        let editor = this.editor
        // 行内代码处理
        let $code = $(`<code>${text}</code>`)
        editor.cmd.do('insertElem', $code)
        editor.selection.createRangeByElem($code, false)
        editor.selection.restoreSelection()
    }

    /**
     * 菜单点击事件
     */
    public clickHandler(): void {
        const editor = this.editor
        const selectionText = editor.selection.getSelectionText()

        if (this.isActive) {
            return
        } else {
            // 菜单未被激活，说明选区不在链接里
            if (editor.selection.isSelectionEmpty()) {
                // 选区是空的，未选中内容
                this.createPanel('', '')
            } else {
                // 行内代码处理 选中了非代码内容
                this.insertLineCode(selectionText)
            }
        }
    }

    /**
     * 创建 panel
     * @param text 代码文本
     * @param languageType 代码类型
     */
    public createPanel(text: string, languageType: string): void {
        const conf = createPanelConf(this.editor, text, languageType)
        const panel = new Panel(this, conf)
        panel.create()
    }

    /**
     * 尝试修改菜单 active 状态
     */
    public tryChangeActive() {
        const editor = this.editor
        if (isActive(editor)) {
            this.active()
        } else {
            this.unActive()
        }
    }
}

export default Code
