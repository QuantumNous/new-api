/**
 * @description Modal 菜单 Class
 * @author wangfupeng
 */

import { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import Menu from './Menu'
import Panel from './Panel'

class PanelMenu extends Menu {
    public panel: Panel | undefined

    constructor($elem: DomElement, editor: Editor) {
        super($elem, editor)
    }

    /**
     * 给 menu 设置 panel
     * @param panel panel 实例
     */
    public setPanel(panel: Panel): void {
        this.panel = panel
    }
}

export default PanelMenu
