import Editor from '../../editor/index';
import PanelMenu from '../menu-constructors/PanelMenu';
import { MenuActive } from '../menu-constructors/Menu';
declare class Emoticon extends PanelMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 创建 panel
     */
    private createPanel;
    /**
     * 菜单表情点击事件
     */
    clickHandler(): void;
    tryChangeActive(): void;
}
export default Emoticon;
