/**
 * @description 插入、上传图片
 * @author wangfupeng
 */

import Editor from '../../editor/index'
import { EMPTY_FN } from '../../utils/const'
import $ from '../../utils/dom-core'
import { MenuActive } from '../menu-constructors/Menu'
import Panel from '../menu-constructors/Panel'
import PanelMenu from '../menu-constructors/PanelMenu'
import bindEvent from './bind-event/index'
import createPanelConf, { ImgPanelConf } from './create-panel-conf'

class Image extends PanelMenu implements MenuActive {
    private imgPanelConfig: ImgPanelConf

    constructor(editor: Editor) {
        let $elem = $(
            '<div class="w-e-menu" data-title="图片"><i class="w-e-icon-image"></i></div>'
        )
        let imgPanelConfig = createPanelConf(editor)
        if (imgPanelConfig.onlyUploadConf) {
            $elem = imgPanelConfig.onlyUploadConf.$elem
            imgPanelConfig.onlyUploadConf.events.map(event => {
                const type = event.type
                const fn = event.fn || EMPTY_FN
                $elem.on(type, (e: Event) => {
                    e.stopPropagation()
                    fn(e)
                })
            })
        }
        super($elem, editor)
        this.imgPanelConfig = imgPanelConfig

        // 绑定事件，如粘贴图片
        bindEvent(editor)
    }

    /**
     * 菜单点击事件
     */
    public clickHandler(): void {
        if (!this.imgPanelConfig.onlyUploadConf) {
            this.createPanel()
        }
    }

    /**
     * 创建 panel
     */
    private createPanel(): void {
        const conf = this.imgPanelConfig
        const panel = new Panel(this, conf)
        this.setPanel(panel)
        panel.create()
    }

    /**
     * 尝试修改菜单 active 状态
     */
    public tryChangeActive() {}
}

export default Image
