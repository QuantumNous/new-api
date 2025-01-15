/**
 * @description Menu class 父类
 * @author wangfupeng
 */
import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor/index';
export interface MenuActive {
    /**
     * 修改菜单激活状态，菜单是否高亮
     */
    tryChangeActive(): void;
}
declare class Menu {
    key: string | undefined;
    $elem: DomElement;
    editor: Editor;
    private _active;
    constructor($elem: DomElement, editor: Editor);
    /**
     * 菜单点击事件，子类可重写
     * @param e event
     */
    protected clickHandler(e: Event): void;
    /**
     * 激活菜单，高亮显示
     */
    protected active(): void;
    /**
     * 取消激活，不再高亮显示
     */
    protected unActive(): void;
    /**
     * 是否处于激活状态
     */
    get isActive(): boolean;
}
export default Menu;
