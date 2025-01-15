/**
 * @description 完整的内容备份，每次变化都将备份整个编辑器的内容
 * @author fangzhicong
 */
import Editor from '../../../index';
export default class HtmlCache {
    editor: Editor;
    private data;
    constructor(editor: Editor);
    /**
     * 初始化绑定
     */
    observe(): void;
    /**
     * 保存
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
