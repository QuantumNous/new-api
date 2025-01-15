/**
 * @description range变化
 * @author liuwei
 */
import Editor from '../index';
export default class SelectionChange {
    editor: Editor;
    constructor(editor: Editor);
    emit(): void;
}
