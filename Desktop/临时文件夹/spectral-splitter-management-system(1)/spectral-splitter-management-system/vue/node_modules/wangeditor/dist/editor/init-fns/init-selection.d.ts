/**
 * @description 初始化编辑器选区，将光标定位到文档末尾
 * @author wangfupeng
 */
import Editor from '../index';
/**
 * 初始化编辑器选区，将光标定位到文档末尾
 * @param editor 编辑器实例
 * @param newLine 是否新增一行
 */
declare function initSelection(editor: Editor, newLine?: boolean): void;
export default initSelection;
