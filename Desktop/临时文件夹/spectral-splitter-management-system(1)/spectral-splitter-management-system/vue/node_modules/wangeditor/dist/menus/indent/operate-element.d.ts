/**
 * @description 对节点 操作 进行封装
 *                  获取当前节点的段落
 *                  根据type判断是增加还是减少缩进
 * @author tonghan
 */
import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor/index';
declare function operateElement($node: DomElement, type: String, editor: Editor): void;
export default operateElement;
