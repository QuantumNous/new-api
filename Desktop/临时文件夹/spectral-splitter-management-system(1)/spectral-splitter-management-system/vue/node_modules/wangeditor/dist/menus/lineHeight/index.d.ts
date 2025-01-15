/**
 * @description 段落行高 LineHeight
 * @author lichunlin
 *
 */
import DropListMenu from '../menu-constructors/DropListMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
declare class LineHeight extends DropListMenu implements MenuActive {
    constructor(editor: Editor);
    /**
     * 执行命令
     * @param value value
     */
    command(value: string): void;
    /**
     * 遍历dom 获取祖父元素 直到contenteditable属性的div标签
     *
     */
    getDom(dom: HTMLElement): HTMLElement;
    /**
     * style 处理
     *
     * 废弃的方法
     */
    styleProcessing(styleList: Array<string>): string;
    /**
     * 段落全选 比如：避免11变成111
     *
     * 废弃的方法
     */
    setRange(startDom: Node, endDom: Node): void;
    /**
     * 尝试修改菜单激活状态
     */
    tryChangeActive(): void;
}
export default LineHeight;
