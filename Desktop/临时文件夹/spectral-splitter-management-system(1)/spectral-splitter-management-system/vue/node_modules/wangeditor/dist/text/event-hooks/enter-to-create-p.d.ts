/**
 * @description 回车时，保证生成的是 <p> 标签
 * @author wangfupeng
 */
import Editor from '../../editor/index';
/**
 * 回车时，保证生成的是 <p> 标签
 * @param editor 编辑器实例
 * @param enterUpEvents enter 键 up 时的 hooks
 * @param enterDownEvents enter 键 down 时的 hooks
 */
declare function enterToCreateP(editor: Editor, enterUpEvents: Function[], enterDownEvents: Function[]): void;
export default enterToCreateP;
