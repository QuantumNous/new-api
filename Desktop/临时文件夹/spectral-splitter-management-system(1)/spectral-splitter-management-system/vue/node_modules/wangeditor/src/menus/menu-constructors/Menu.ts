/**
 * @description Menu class 父类
 * @author wangfupeng
 */

import { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import Panel from './Panel'

export interface MenuActive {
    /**
     * 修改菜单激活状态，菜单是否高亮
     */
    tryChangeActive(): void
}

class Menu {
    public key: string | undefined
    public $elem: DomElement
    public editor: Editor
    private _active: boolean // 菜单是否处于激活状态，如选中一段加粗文字时，bold 菜单要被激活（即高亮显示）

    constructor($elem: DomElement, editor: Editor) {
        this.$elem = $elem
        this.editor = editor
        this._active = false

        // 绑定菜单点击事件
        $elem.on('click', (e: Event) => {
            Panel.hideCurAllPanels() // 隐藏当前的所有 Panel

            // 触发菜单点击的钩子
            editor.txt.eventHooks.menuClickEvents.forEach(fn => fn())

            e.stopPropagation()
            if (editor.selection.getRange() == null) {
                return
            }
            this.clickHandler(e)
        })
    }

    /**
     * 菜单点击事件，子类可重写
     * @param e event
     */
    protected clickHandler(e: Event): void {}

    /**
     * 激活菜单，高亮显示
     */
    protected active(): void {
        this._active = true
        this.$elem.addClass('w-e-active')
    }

    /**
     * 取消激活，不再高亮显示
     */
    protected unActive(): void {
        this._active = false
        this.$elem.removeClass('w-e-active')
    }

    /**
     * 是否处于激活状态
     */
    public get isActive() {
        return this._active
    }
}

export default Menu
