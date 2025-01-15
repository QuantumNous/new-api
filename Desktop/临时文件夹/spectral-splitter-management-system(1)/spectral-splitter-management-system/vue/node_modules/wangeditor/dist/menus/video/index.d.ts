/**
 * @description 视频 菜单
 * @author tonghan
 */
import Editor from '../../editor/index';
import PanelMenu from '../menu-constructors/PanelMenu';
import { MenuActive } from '../menu-constructors/Menu';
declare class Video extends PanelMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 菜单点击事件
     */
    clickHandler(): void;
    /**
     * 创建 panel
     * @param link 链接
     */
    private createPanel;
    /**
     * 尝试修改菜单 active 状态
     */
    tryChangeActive(): void;
}
export default Video;
