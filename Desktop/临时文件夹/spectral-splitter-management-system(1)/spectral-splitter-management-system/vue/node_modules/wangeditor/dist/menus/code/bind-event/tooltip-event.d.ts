/**
 * @description tooltip 事件
 * @author lkw
 */
import { DomElement } from '../../../utils/dom-core';
import Editor from '../../../editor/index';
/**
 * 生成 Tooltip 的显示隐藏函数
 */
export declare function createShowHideFn(editor: Editor): {
    showCodeTooltip: ($code: DomElement) => void;
    hideCodeTooltip: () => void;
};
/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */
export default function bindTooltipEvent(editor: Editor): void;
