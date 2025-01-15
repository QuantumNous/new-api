/**
 * @description 记录 range 变化
 * @author fangzhicong
 */
import Cache from '../../../../utils/data-structure/cache';
import Editor from '../../../index';
import { RangeItem } from '../type';
/**
 * 编辑区 range 缓存管理器
 */
export default class RangeCache extends Cache<[RangeItem, RangeItem]> {
    editor: Editor;
    /**
     * 变化前的 Range 数据
     */
    private lastRange;
    /**
     * 有效选区的根节点
     */
    private root;
    updateLastRange: Function;
    constructor(editor: Editor);
    /**
     * 获取 Range 对象
     */
    get rangeHandle(): Range;
    /**
     * 初始化绑定
     */
    observe(): void;
    /**
     * 保存 Range
     */
    save(): this;
    /**
     * 设置 Range，在 撤销/恢复 中调用
     * @param range 缓存的 Range 数据
     */
    set(range: RangeItem | undefined): boolean;
    /**
     * 撤销
     */
    revoke(): boolean;
    /**
     * 恢复
     */
    restore(): boolean;
}
