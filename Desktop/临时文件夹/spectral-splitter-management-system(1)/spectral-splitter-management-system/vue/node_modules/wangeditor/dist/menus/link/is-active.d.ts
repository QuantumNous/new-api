/**
 * @description 检查选区是否在链接中，即菜单是否应该 active
 * @author wangfupeng
 */
import Editor from '../../editor/index';
import { DomElement } from '../../utils/dom-core';
export declare const EXTRA_TAG: string[];
export declare function getParentNodeA(selectionELem: DomElement): HTMLElement | undefined;
declare function isActive(editor: Editor): boolean;
export default isActive;
