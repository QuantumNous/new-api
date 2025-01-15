import BtnMenu from '../menu-constructors/BtnMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class Todo extends BtnMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 点击事件
     */
    clickHandler(): void;
    tryChangeActive(): void;
    /**
     * 设置todo
     */
    private setTodo;
    /**
     * 取消设置todo
     */
    private cancelTodo;
}
export default Todo;
