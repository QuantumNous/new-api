/**
 * @description 下划线 underline
 * @author dyl
 *
 */
import BtnMenu from '../menu-constructors/BtnMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class Underline extends BtnMenu implements MenuActive {
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
export default Underline;
