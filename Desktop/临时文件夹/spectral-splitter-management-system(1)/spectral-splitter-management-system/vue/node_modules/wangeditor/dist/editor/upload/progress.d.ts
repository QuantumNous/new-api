/**
 * @description 上传进度条
 * @author wangfupeng
 */
import Editor from '../../editor/index';
declare class Progress {
    private editor;
    private $bar;
    private $textContainer;
    private isShow;
    private time;
    private timeoutId;
    constructor(editor: Editor);
    /**
     * 显示进度条
     * @param progress 进度百分比
     */
    show(progress: number): void;
    /**
     * 隐藏
     */
    private hide;
}
export default Progress;
