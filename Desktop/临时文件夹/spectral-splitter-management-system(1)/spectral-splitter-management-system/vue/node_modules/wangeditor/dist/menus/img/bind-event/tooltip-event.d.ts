/**
 * @description tooltip 事件
 * @author lichunlin
 */
import { DomElement } from '../../../utils/dom-core';
import Editor from '../../../editor/index';
/**
 * 生成 Tooltip 的显示隐藏函数
 */
export declare function createShowHideFn(editor: Editor): {
    showImgTooltip: ($node: DomElement) => void;
    hideImgTooltip: () => void;
};
/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */
export default function bindTooltipEvent(editor: Editor): void;
