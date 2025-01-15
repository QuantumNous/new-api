/**
 * @description 分割线
 * @author wangqiaoling
 */
import BtnMenu from '../menu-constructors/BtnMenu'
import $ from '../../utils/dom-core'
import Editor from '../../editor/index'
import { MenuActive } from '../menu-constructors/Menu'
import bindEvent from './bind-event/index'
import { UA } from '../../utils/util'
import { EMPTY_P } from '../../utils/const'
class splitLine extends BtnMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            '<div class="w-e-menu" data-title="分割线"><i class="w-e-icon-split-line"></i></div>'
        )
        super($elem, editor)
        // 绑定事件
        bindEvent(editor)
    }
    /**
     * 菜单点击事件
     */
    public clickHandler(): void {
        const editor = this.editor
        const range = editor.selection.getRange()

        const $selectionElem = editor.selection.getSelectionContainerElem()
        if (!$selectionElem?.length) return

        const $DomElement = $($selectionElem.elems[0])
        const $tableDOM = $DomElement.parentUntil('TABLE', $selectionElem.elems[0])
        const $imgDOM = $DomElement.children()

        // 禁止在代码块中添加分割线
        if ($DomElement.getNodeName() === 'CODE') return
        // 禁止在表格中添加分割线
        if ($tableDOM && $($tableDOM.elems[0]).getNodeName() === 'TABLE') return

        // 禁止在图片处添加分割线
        if (
            $imgDOM &&
            $imgDOM.length !== 0 &&
            $($imgDOM.elems[0]).getNodeName() === 'IMG' &&
            !range?.collapsed // 处理光标在 img 后面的情况
        ) {
            return
        }

        this.createSplitLine()
    }
    /**
     * 创建 splitLine
     */
    private createSplitLine(): void {
        // 防止插入分割线时没有占位元素的尴尬
        let splitLineDOM: string = `<hr/>${EMPTY_P}`
        // 火狐浏览器不需要br标签占位
        if (UA.isFirefox) {
            splitLineDOM = '<hr/><p></p>'
        }
        this.editor.cmd.do('insertHTML', splitLineDOM)
    }
    /**
     * 尝试修改菜单激活状态
     */
    public tryChangeActive(): void {}
}
export default splitLine
