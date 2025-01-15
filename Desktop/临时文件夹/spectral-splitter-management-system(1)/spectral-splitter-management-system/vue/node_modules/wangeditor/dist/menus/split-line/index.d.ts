/**
 * @description 分割线
 * @author wangqiaoling
 */
import BtnMenu from '../menu-constructors/BtnMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class splitLine extends BtnMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 菜单点击事件
     */
    clickHandler(): void;
    /**
     * 创建 splitLine
     */
    private createSplitLine;
    /**
     * 尝试修改菜单激活状态
     */
    tryChangeActive(): void;
}
export default splitLine;
