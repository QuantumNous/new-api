/**
 * @description panel class
 * @author wangfupeng
 */
import { DomElement } from '../../utils/dom-core';
import PanelMenu from './PanelMenu';
export declare type TabEventConf = {
    selector: string;
    type: string;
    fn: Function;
    bindEnter?: Boolean;
};
export declare type PanelTabConf = {
    title: string;
    tpl: string;
    events: TabEventConf[];
};
export declare type PanelConf = {
    width: number | 0;
    height: number | 0;
    tabs: PanelTabConf[];
    setLinkValue?: ($container: DomElement, type: string) => void;
};
declare class Panel {
    static createdMenus: Set<PanelMenu>;
    private menu;
    private conf;
    $container: DomElement;
    constructor(menu: PanelMenu, conf: PanelConf);
    /**
     * 创建并展示 panel
     */
    create(): void;
    /**
     * 移除 penal
     */
    remove(): void;
    /**
     * 隐藏当前所有的 panel
     */
    static hideCurAllPanels(): void;
}
export default Panel;
