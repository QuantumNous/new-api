/**
 * @description 记录 scrollTop
 * @author fangzhicong
 */
import Cache from '../../../../utils/data-structure/cache';
import Editor from '../../../index';
import { ScrollItem } from '../type';
export default class ScrollCache extends Cache<ScrollItem> {
    editor: Editor;
    /**
     * 上一次的 scrollTop
     */
    private last;
    /**
     * 编辑区容器元素节点
     */
    private target;
    constructor(editor: Editor);
    /**
     * 给编辑区容器绑定 scroll 事件
     */
    observe(): void;
    /**
     * 保存 scrollTop 值
     */
    save(): this;
    /**
     * 撤销
     */
    revoke(): boolean;
    /**
     * 恢复
     */
    restore(): boolean;
}
