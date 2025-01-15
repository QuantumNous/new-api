/**
 * @description Tooltip class
 * @author wangfupeng
 */
import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor/index';
export declare type TooltipConfItemType = {
    $elem: DomElement;
    onClick: Function;
};
export declare type TooltipConfType = Array<TooltipConfItemType>;
declare class Tooltip {
    private $container;
    private $targetElem;
    private editor;
    private conf;
    private _show;
    private _isInsertTextContainer;
    constructor(editor: Editor, $elem: DomElement, conf: TooltipConfType);
    /**
     * 获取 tooltip 定位
     */
    private getPositionData;
    /**
     * 添加 tooltip 菜单
     */
    private appendMenus;
    /**
     * 创建 tooltip
     */
    create(): void;
    /**
     * 移除该 tooltip
     */
    remove(): void;
    /**
     * 是否显示
     */
    get isShow(): boolean;
}
export default Tooltip;
