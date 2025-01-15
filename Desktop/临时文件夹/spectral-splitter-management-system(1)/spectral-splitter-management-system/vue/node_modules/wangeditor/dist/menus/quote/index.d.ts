/**
 * @description 引用
 * @author tonghan
 */
import Editor from '../../editor/index';
import BtnMenu from '../menu-constructors/BtnMenu';
import { MenuActive } from '../menu-constructors/Menu';
declare class Quote extends BtnMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 点击事件
     */
    clickHandler(): void;
    /**
     * 尝试修改菜单激活状态
     */
    tryChangeActive(): void;
    /**
     * 获取包裹在最外层的节点(防止内部嵌入多个样式)
     * @param selectionElem 选中的节点
     * @returns {string} 最终要处理的节点名称
     */
    private getTopNodeName;
    /**
     * 删除选中的元素
     * @param selectElem 选中的元素节点数组
     */
    private delSelectNode;
}
export default Quote;
