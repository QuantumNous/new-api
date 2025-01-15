/**
 * @description 链接 菜单
 * @author wangfupeng
 */
import PanelMenu from '../menu-constructors/PanelMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class Link extends PanelMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 菜单点击事件
     */
    clickHandler(): void;
    /**
     * 创建 panel
     * @param text 文本
     * @param link 链接
     */
    private createPanel;
    /**
     * 尝试修改菜单 active 状态
     */
    tryChangeActive(): void;
}
export default Link;
