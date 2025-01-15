/**
 * @description 对齐方式
 * @author liuwei
 */
import DropListMenu from '../menu-constructors/DropListMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class Justify extends DropListMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 执行命令
     * @param value value
     */
    command(value: string): void;
    /**
     * 获取选区中的特殊元素，如果不存在，则直接返回顶层元素子元素
     * @param el DomElement
     * @param topEl DomElement
     */
    private getSpecialNodeUntilTop;
    /**
     * 当选区元素或者顶层元素是某些特殊元素时，只需要修改子元素的对齐样式的元素
     * @param el DomElement
     * @param topEl DomElement
     */
    private isSpecialNode;
    /**
     * 当选区 top 元素为某些特殊元素时，只需要修改子元素的对齐样式的元素
     * @param el DomElement
     */
    private isSpecialTopNode;
    /**
     * 尝试改变菜单激活（高亮）状态
     * 默认左对齐,若选择其他对其方式对active进行高亮否则unActive
     * ?考虑优化的话 是否可以对具体选中的进行高亮
     */
    tryChangeActive(): void;
}
export default Justify;
