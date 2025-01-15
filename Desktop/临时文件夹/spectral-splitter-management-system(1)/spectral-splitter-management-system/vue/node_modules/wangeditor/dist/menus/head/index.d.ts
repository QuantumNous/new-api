/**
 * @description 标题
 * @author wangfupeng
 */
import DropListMenu from '../menu-constructors/DropListMenu';
import Editor from '../../editor/index';
import { MenuActive } from '../menu-constructors/Menu';
import { TCatalog } from '../../config/events';
declare class Head extends DropListMenu implements MenuActive {
    oldCatalogs: TCatalog[] | undefined;
    constructor(editor: Editor);
    /**
     * 执行命令
     * @param value value
     */
    command(value: string): void;
    /**
     * 为标题设置大纲
     */
    private addUidForSelectionElem;
    /**
     * 监听change事件来返回大纲信息
     */
    private addListenerCatalog;
    /**
     * 获取大纲数组
     */
    private getCatalogs;
    /**
     * 设置选中的多行标题
     * @param value  需要执行的命令值
     */
    private setMultilineHead;
    /**
     * 是否含有某元素
     * @param elem 需要检查的元素
     * @param whiteList 白名单
     */
    private hasTag;
    /**
     * 尝试改变菜单激活（高亮）状态
     */
    tryChangeActive(): void;
}
export default Head;
