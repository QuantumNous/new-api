/**
 * @description 从nodeList json格式中遍历生成dom元素
 * @author zhengwenjian
 */
import { DomElement } from './../utils/dom-core';
import { NodeListType } from './getChildrenJSON';
declare function getHtmlByNodeList(nodeList: NodeListType, parent?: Node): DomElement;
export default getHtmlByNodeList;
