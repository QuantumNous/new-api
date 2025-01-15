/**
 * @description 差异备份
 * @author fangzhicong
 */
import Cache from '../../../../utils/data-structure/cache';
import { Compile } from '../type';
import Editor from '../../../index';
export default class NodeCache extends Cache<Compile[]> {
    editor: Editor;
    constructor(editor: Editor);
    observe(): void;
    /**
     * 编译并保存数据
     */
    compile(data: MutationRecord[]): this;
    /**
     * 撤销
     */
    revoke(): boolean;
    /**
     * 恢复
     */
    restore(): boolean;
}
