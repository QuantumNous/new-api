/**
 * @description 文字颜色 FontColor
 * @author lkw
 *
 */
import DropListMenu from '../menu-constructors/DropListMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class FontColor extends DropListMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 执行命令
     * @param value value
     */
    command(value: string): void;
    /**
     * 尝试修改菜单激活状态
     */
    tryChangeActive(): void;
}
export default FontColor;
