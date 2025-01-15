/**
 * @description 历史记录
 * @author fangzhicong
 */
import Editor from '../index';
/**
 * 历史记录（撤销、恢复）
 */
export default class History {
    editor: Editor;
    private content;
    private scroll;
    private range;
    constructor(editor: Editor);
    /**
     *  获取缓存中的数据长度。格式为：[正常的数据的条数，被撤销的数据的条数]
     */
    get size(): number[];
    /**
     * 初始化绑定。在 editor.create() 结尾时调用
     */
    observe(): void;
    /**
     * 保存数据
     */
    save(mutations: MutationRecord[]): void;
    /**
     * 撤销
     */
    revoke(): void;
    /**
     * 恢复
     */
    restore(): void;
}
