/**
 * @description 引用
 * @author tonghan
 */

import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import BtnMenu from '../menu-constructors/BtnMenu'
import { MenuActive } from '../menu-constructors/Menu'
import bindEvent from './bind-event'
import createQuote from './create-quote-node'
import { EMPTY_P } from '../../utils/const'

class Quote extends BtnMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="引用">
                <i class="w-e-icon-quotes-left"></i>
            </div>`
        )
        super($elem, editor)
        bindEvent(editor)
    }

    /**
     * 点击事件
     */
    public clickHandler(): void {
        const editor = this.editor
        const isSelectEmpty = editor.selection.isSelectionEmpty()
        let topNodeElem: DomElement[] = editor.selection.getSelectionRangeTopNodes()
        const $topNodeElem: DomElement = topNodeElem[topNodeElem.length - 1]
        const nodeName = this.getTopNodeName()
        // IE 中不支持 formatBlock <BLOCKQUOTE> ，要用其他方式兼容
        // 兼容firefox无法取消blockquote的问题
        if (nodeName === 'BLOCKQUOTE') {
            // 撤销 quote
            const $targetELem = $($topNodeElem.childNodes())
            const len = $targetELem.length
            let $middle = $topNodeElem
            $targetELem.forEach((elem: Node) => {
                const $elem = $(elem)
                $elem.insertAfter($middle)
                $middle = $elem
            })
            $topNodeElem.remove()
            editor.selection.moveCursor($targetELem.elems[len - 1])
            // 即时更新btn状态
            this.tryChangeActive()
        } else {
            // 将 P 转换为 quote

            /**
            @author:gavin
            @description 
                1. 解决ctrl+a全选删除后，选区错位的问题。
                2. 或者内容清空，按删除键后，选区错位。

                导致topNodeElem选择的是编辑器顶层元素，在进行dom操作时，quote插入的位置有问题。
            **/
            let $quote = createQuote(topNodeElem)

            //如果选择的元素时顶层元素，就将选区移动到正确的位置
            if (editor.$textElem.equal($topNodeElem)) {
                const containerElem = editor.selection.getSelectionContainerElem()?.elems[0]!
                editor.selection.createRangeByElems(
                    containerElem.children[0],
                    containerElem.children[0]
                )

                topNodeElem = editor.selection.getSelectionRangeTopNodes()
                $quote = createQuote(topNodeElem)
                $topNodeElem.append($quote)
            } else {
                $quote.insertAfter($topNodeElem)
            }

            this.delSelectNode(topNodeElem)
            const moveNode = $quote.childNodes()?.last().getNode() as Node

            if (moveNode == null) return

            // 兼容firefox（firefox下空行情况下选区会在br后，造成自动换行的问题）
            moveNode.textContent
                ? editor.selection.moveCursor(moveNode)
                : editor.selection.moveCursor(moveNode, 0)
            // 即时更新btn状态
            this.tryChangeActive()
            // 防止最后一行无法跳出
            $(EMPTY_P).insertAfter($quote)
            return
        }

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
        const cmdValue = editor.selection.getSelectionRangeTopNodes()[0]?.getNodeName()
        if (cmdValue === 'BLOCKQUOTE') {
            this.active()
        } else {
            this.unActive()
        }
    }

    /**
     * 获取包裹在最外层的节点(防止内部嵌入多个样式)
     * @param selectionElem 选中的节点
     * @returns {string} 最终要处理的节点名称
     */
    private getTopNodeName(): string {
        const editor = this.editor
        const $topNodeElem = editor.selection.getSelectionRangeTopNodes()[0]
        const nodeName = $topNodeElem?.getNodeName()

        return nodeName
    }

    /**
     * 删除选中的元素
     * @param selectElem 选中的元素节点数组
     */
    private delSelectNode(selectElem: DomElement[]) {
        selectElem.forEach(node => {
            node.remove()
        })
    }
}

export default Quote
