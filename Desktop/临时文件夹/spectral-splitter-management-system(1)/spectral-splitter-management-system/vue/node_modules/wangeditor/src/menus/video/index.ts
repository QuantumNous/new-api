/**
 * @description 视频 菜单
 * @author tonghan
 */

import $ from '../../utils/dom-core'
import Panel from '../menu-constructors/Panel'
import Editor from '../../editor/index'
import PanelMenu from '../menu-constructors/PanelMenu'
import { MenuActive } from '../menu-constructors/Menu'
import createPanelConf from './create-panel-conf'
import bindEvent from './bind-event/index'

class Video extends PanelMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="视频">
                <i class="w-e-icon-play"></i>
            </div>`
        )
        super($elem, editor)

        // 绑定事件 tootip
        bindEvent(editor)
    }

    /**
     * 菜单点击事件
     */
    public clickHandler(): void {
        // 弹出 panel
        this.createPanel('')
    }

    /**
     * 创建 panel
     * @param link 链接
     */
    private createPanel(iframe: string): void {
        const conf = createPanelConf(this.editor, iframe)
        const panel = new Panel(this, conf)
        panel.create()
    }

    /**
     * 尝试修改菜单 active 状态
     */
    public tryChangeActive() {}
}

export default Video
