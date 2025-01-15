/**
 * @description 段落行高 LineHeight
 * @author lichunlin
 *
 */

import DropListMenu from '../menu-constructors/DropListMenu'
import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import { MenuActive } from '../menu-constructors/Menu'
import lineHeightList from './lineHeightList'

class LineHeight extends DropListMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="行高">
                    <i class="w-e-icon-row-height"></i>
                </div>`
        )
        let lineHeightMenu = new lineHeightList(editor, editor.config.lineHeights)
        const DropListMenu = {
            width: 100,
            title: '设置行高',
            type: 'list', // droplist 以列表形式展示
            list: lineHeightMenu.getItemList(),
            clickHandler: (value: string) => {
                //保存焦点
                editor.selection.saveRange()
                this.command(value)
            },
        }

        super($elem, editor, DropListMenu)
    }

    /**
     * 执行命令
     * @param value value
     */
    public command(value: string): void {
        const editor = this.editor

        //重置选区
        editor.selection.restoreSelection()

        // 获取选区的祖先元素
        const $containerElem = $(editor.selection.getSelectionContainerElem())

        if (!$containerElem.elems.length) return

        //选中多行操作
        if ($containerElem && editor.$textElem.equal($containerElem)) {
            // 标识是否可以设置行高的样式
            let setStyleLock: boolean = false

            //获取range 开头结束的dom
            const selectionStartElem: HTMLElement = $(editor.selection.getSelectionStartElem())
                .elems[0]
            const SelectionEndElem: HTMLElement = $(editor.selection.getSelectionEndElem()).elems[0]

            // 获取选区中，在contenteditable下的直接父元素
            const StartElemWrap: HTMLElement = this.getDom(selectionStartElem)
            const EndElemWrap: HTMLElement = this.getDom(SelectionEndElem)

            const containerElemChildren = $containerElem.elems[0].children

            for (let i = 0; i < containerElemChildren.length; i++) {
                const item: HTMLElement = containerElemChildren[i] as HTMLElement

                // 目前只支持p 段落标签设置行高
                if ($(item).getNodeName() !== 'P') {
                    continue
                }

                if (item === StartElemWrap) {
                    setStyleLock = true
                }

                // 证明在区间节点里
                if (setStyleLock) {
                    $(item).css('line-height', value)

                    if (item === EndElemWrap) {
                        setStyleLock = false

                        // 当设置完选择的EndElemWrap时，就可以退出
                        return
                    }
                }
            }

            //重新设置选区
            editor.selection.createRangeByElems(selectionStartElem, SelectionEndElem)

            return
        }

        // 单行操作
        // 选中区间的dom元素
        const selectElem = $containerElem.elems[0]

        // 获取选区中，在contenteditable下的直接父元素
        const selectElemWrapdom = this.getDom(selectElem)

        // 目前只支持p 段落标签设置行高
        if ($(selectElemWrapdom).getNodeName() !== 'P') {
            return
        }

        $(selectElemWrapdom).css('line-height', value)

        //重新设置选区
        editor.selection.createRangeByElems(selectElemWrapdom, selectElemWrapdom)

        return
    }

    /**
     * 遍历dom 获取祖父元素 直到contenteditable属性的div标签
     *
     */
    public getDom(dom: HTMLElement): HTMLElement {
        let DOM: HTMLElement = $(dom).elems[0]
        if (!DOM.parentNode) {
            return DOM
        }
        function getParentNode($node: HTMLElement, editor: Editor): HTMLElement {
            const $parent = $($node.parentNode)
            if (editor.$textElem.equal($parent)) {
                return $node
            } else {
                return getParentNode($parent.elems[0], editor)
            }
        }
        DOM = getParentNode(DOM, this.editor)

        return DOM
    }

    /**
     * style 处理
     *
     * 废弃的方法
     */
    public styleProcessing(styleList: Array<string>): string {
        let styleStr = ''
        styleList.forEach(item => {
            item !== '' && item.indexOf('line-height') === -1
                ? (styleStr = styleStr + item + ';')
                : ''
        })
        return styleStr
    }

    /**
     * 段落全选 比如：避免11变成111
     *
     * 废弃的方法
     */
    public setRange(startDom: Node, endDom: Node): void {
        const editor = this.editor
        let selection = window.getSelection ? window.getSelection() : document.getSelection()
        //清除所有的选区
        selection?.removeAllRanges()
        const range = document.createRange()
        let star = startDom
        let end = endDom
        range.setStart(star, 0)
        range.setEnd(end, 1)
        selection?.addRange(range)
        //保存设置好的选区
        editor.selection.saveRange()
        //清除所有的选区
        selection?.removeAllRanges()
        //恢复选区
        editor.selection.restoreSelection()
    }

    /**
     * 尝试修改菜单激活状态
     */
    public tryChangeActive(): void {
        const editor = this.editor
        const $selectionElem = editor.selection.getSelectionContainerElem()
        if ($selectionElem && editor.$textElem.equal($selectionElem)) {
            //避免选中多行设置
            return
        }
        let dom: DomElement | HTMLElement = $(editor.selection.getSelectionStartElem())
        // 有些情况下 dom 可能为空，比如编辑器初始化
        if (dom.length === 0) return

        dom = this.getDom(dom.elems[0])
        let style: string | null = dom.getAttribute('style') ? dom.getAttribute('style') : ''

        //判断当前标签是否具有line-height属性
        if (style && style.indexOf('line-height') !== -1) {
            this.active()
        } else {
            this.unActive()
        }
    }
}

export default LineHeight
