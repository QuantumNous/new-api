/**
 * @description 字体样式 FontStyle
 * @author dyl
 *
 */
import DropListMenu from '../menu-constructors/DropListMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class FontStyle extends DropListMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 执行命令
     * @param value value
     */
    command(value: string): void;
    /**
     * 尝试修改菜单激活状态
     * ?字体是否需要有激活状态这个操作?
     */
    tryChangeActive(): void;
}
export default FontStyle;
