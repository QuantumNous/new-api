/**
 * @description 按钮菜单 Class
 * @author wangfupeng
 */
import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor/index';
import Menu from './Menu';
declare class BtnMenu extends Menu {
    constructor($elem: DomElement, editor: Editor);
}
export default BtnMenu;
