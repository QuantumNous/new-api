/**
 * @description 获取子元素的 JSON 格式数据
 * @author wangfupeng
 */
import { DomElement } from '../utils/dom-core';
declare type AttrType = {
    name: string;
    value: string;
};
export declare type NodeType = {
    tag: string;
    attrs: AttrType[];
    children: NodeListType;
};
export declare type NodeListType = Array<string | NodeType>;
/**
 * 获取子元素的 JSON 格式数据
 * @param $elem DOM 节点
 */
declare function getChildrenJSON($elem: DomElement): NodeListType;
export default getChildrenJSON;
