/**
 * @description Modal 菜单 Class
 * @author wangfupeng
 */
import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor/index';
import Menu from './Menu';
import Panel from './Panel';
declare class PanelMenu extends Menu {
    panel: Panel | undefined;
    constructor($elem: DomElement, editor: Editor);
    /**
     * 给 menu 设置 panel
     * @param panel panel 实例
     */
    setPanel(panel: Panel): void;
}
export default PanelMenu;
