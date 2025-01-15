/**
 * @description 图片点击后选区更新到img的位置
 * @author tonghan
 */
import Editor from '../../editor/index';
/**
 * 图片点击后选区更新到img的位置
 * @param editor 编辑器实例
 * @param imgClickEvents delete 键 up 时的 hooks
 */
declare function imgClickActive(editor: Editor, imgClickEvents: Function[]): void;
export default imgClickActive;
