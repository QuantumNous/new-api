/**
 * @description 增加缩进/减少缩进
 * @author tonghan
 */
import Editor from '../../editor/index';
import DropListMenu from '../menu-constructors/DropListMenu';
import { MenuActive } from '../menu-constructors/Menu';
declare class Indent extends DropListMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 执行命令
     * @param value value
     */
    command(value: string): void;
    /**
     * 尝试改变菜单激活（高亮）状态
     */
    tryChangeActive(): void;
}
export default Indent;
