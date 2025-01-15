/**
 * @description 下拉列表 class
 */
import { DomElement } from '../../utils/dom-core';
import DropListMenu from './DropListMenu';
export declare type DropListItem = {
    $elem: DomElement;
    value: string;
};
export declare type DropListConf = {
    title: string;
    list: DropListItem[];
    type: string;
    clickHandler: (value: DropListItem['value']) => void;
    width: number | 100;
};
declare class DropList {
    private menu;
    private conf;
    private $container;
    private rendered;
    private _show;
    hideTimeoutId: number;
    constructor(menu: DropListMenu, conf: DropListConf);
    /**
     * 显示 DropList
     */
    show(): void;
    /**
     * 隐藏 DropList
     */
    hide(): void;
    get isShow(): boolean;
}
export default DropList;
