/**
 * @description 删除时保留 EMPTY_P
 * @author wangfupeng
 */
import Editor from '../../editor/index';
/**
 * 删除时保留 EMPTY_P
 * @param editor 编辑器实例
 * @param deleteUpEvents delete 键 up 时的 hooks
 * @param deleteDownEvents delete 建 down 时的 hooks
 */
declare function deleteToKeepP(editor: Editor, deleteUpEvents: Function[], deleteDownEvents: Function[]): void;
/**
 * 剪切时保留 EMPTY_P
 * @param editor 编辑器实例
 * @param cutEvents keydown hooks
 */
export declare function cutToKeepP(editor: Editor, cutEvents: Function[]): void;
export default deleteToKeepP;
