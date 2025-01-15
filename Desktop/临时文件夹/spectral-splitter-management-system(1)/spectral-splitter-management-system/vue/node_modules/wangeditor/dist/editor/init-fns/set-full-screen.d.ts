/**
 * @description 全屏功能
 * @author xiaokyo
 */
import Editor from '../index';
import '../../assets/style/full-screen.less';
/**
 * 设置全屏
 * @param editor 编辑器实例
 */
export declare const setFullScreen: (editor: Editor) => void;
/**
 * 取消全屏
 * @param editor 编辑器实例
 */
export declare const setUnFullScreen: (editor: Editor) => void;
/**
 * 初始化全屏功能
 * @param editor 编辑器实例
 */
declare const initFullScreen: (editor: Editor) => void;
export default initFullScreen;
