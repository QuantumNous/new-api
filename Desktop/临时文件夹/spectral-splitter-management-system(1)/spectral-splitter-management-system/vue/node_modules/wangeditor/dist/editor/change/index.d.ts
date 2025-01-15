/**
 * @description 编辑器 change 事件
 * @author fangzhicong
 */
import Editor from '../index';
import Mutation from '../../utils/observer/mutation';
/**
 * Change 实现
 */
export default class Change extends Mutation {
    editor: Editor;
    /**
     * 变化的数据集合
     */
    private data;
    /**
     * 异步保存数据
     */
    private asyncSave;
    constructor(editor: Editor);
    /**
     * 保存变化的数据并发布 change event
     */
    private save;
    /**
     * 发布 change event
     */
    emit(): void;
    observe(): void;
}
