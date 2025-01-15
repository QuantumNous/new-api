/**
 * @description 代码 菜单
 * @author lkw
 */
import PanelMenu from '../menu-constructors/PanelMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
export declare function formatCodeHtml(editor: Editor, html: string): string;
declare class Code extends PanelMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 插入行内代码
     * @param text
     * @return null
     */
    private insertLineCode;
    /**
     * 菜单点击事件
     */
    clickHandler(): void;
    /**
     * 创建 panel
     * @param text 代码文本
     * @param languageType 代码类型
     */
    createPanel(text: string, languageType: string): void;
    /**
     * 尝试修改菜单 active 状态
     */
    tryChangeActive(): void;
}
export default Code;
