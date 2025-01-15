/**
 * @description 下拉菜单 Class
 * @author wangfupeng
 */
import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor/index';
import Menu from './Menu';
import DropList, { DropListConf } from './DropList';
declare class DropListMenu extends Menu {
    dropList: DropList;
    constructor($elem: DomElement, editor: Editor, conf: DropListConf);
}
export default DropListMenu;
