/**
 * @description 编辑区域 tab 的特殊处理
 * @author wangfupeng
 */
import Editor from '../../editor/index';
/**
 * 编辑区域 tab 的特殊处理，转换为空格
 * @param editor 编辑器实例
 * @param tabDownEvents tab down 事件钩子
 */
declare function tabHandler(editor: Editor, tabDownEvents: Function[]): void;
export default tabHandler;
