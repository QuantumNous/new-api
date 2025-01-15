/**
 * @description image 菜单 panel tab 配置
 * @author wangfupeng
 */
import Editor from '../../editor/index';
import { DomElement } from '../../utils/dom-core';
import { PanelConf, TabEventConf } from '../menu-constructors/Panel';
export declare type ImgPanelConf = {
    onlyUploadConf?: {
        $elem: DomElement;
        events: TabEventConf[];
    };
} & PanelConf;
export default function (editor: Editor): ImgPanelConf;
