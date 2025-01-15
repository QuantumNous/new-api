/**
 * @description 加粗
 * @author wangfupeng
 */
import BtnMenu from '../menu-constructors/BtnMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class Bold extends BtnMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 点击事件
     */
    clickHandler(): void;
    /**
     * 尝试修改菜单激活状态
     */
    tryChangeActive(): void;
}
export default Bold;
