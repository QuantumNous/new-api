/**
 * @description 图片拖拽事件绑定
 * @author xiaokyo
 */
import Editor from '../../../editor';
import { DomElement } from '../../../utils/dom-core';
import '../../../assets/style/drag-size.less';
/**
 * 生成图片拖拽框的 显示/隐藏 函数
 */
export declare function createShowHideFn(editor: Editor): {
    showDrag: ($target: DomElement) => false | undefined;
    hideDrag: () => void;
};
/**
 * 点击事件委托
 * @param editor 编辑器实例
 */
export default function bindDragImgSize(editor: Editor): void;
