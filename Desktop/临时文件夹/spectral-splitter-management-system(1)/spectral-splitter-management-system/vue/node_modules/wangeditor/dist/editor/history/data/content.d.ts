/**
 * @description 整合差异备份和内容备份，进行统一管理
 * @author fangzhicong
 */
import NodeCache from './node';
import HtmlCache from './html';
import Editor from '../../index';
export default class ContentCache {
    editor: Editor;
    /**
     * 内容备份的管理器
     */
    cache?: HtmlCache | NodeCache;
    constructor(editor: Editor);
    /**
     * 初始化绑定
     */
    observe(): void;
    /**
     * 保存
     */
    save(mutations: MutationRecord[]): void;
    /**
     * 撤销
     */
    revoke(): boolean | undefined;
    /**
     * 恢复
     */
    restore(): boolean | undefined;
}
