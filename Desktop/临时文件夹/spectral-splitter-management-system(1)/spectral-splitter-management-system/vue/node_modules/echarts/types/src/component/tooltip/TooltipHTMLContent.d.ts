import type ExtensionAPI from '../../core/ExtensionAPI.js';
import type { TooltipOption } from './TooltipModel.js';
import Model from '../../model/Model.js';
import type { ZRColor } from '../../util/types.js';
interface TooltipContentOption {
    /**
     * `false`: the DOM element will be inside the container. Default value.
     * `true`: the DOM element will be appended to HTML body, which avoid
     *  some overflow clip but intrude outside of the container.
     */
    appendToBody: boolean;
}
declare class TooltipHTMLContent {
    el: HTMLDivElement;
    private _container;
    private _show;
    private _styleCoord;
    private _appendToBody;
    private _enterable;
    private _zr;
    private _hideTimeout;
    /**
     * Hide delay time
     */
    private _hideDelay;
    private _inContent;
    private _firstShow;
    private _longHide;
    /**
     * Record long-time hide
     */
    private _longHideTimeout;
    constructor(container: HTMLElement, api: ExtensionAPI, opt: TooltipContentOption);
    /**
     * Update when tooltip is rendered
     */
    update(tooltipModel: Model<TooltipOption>): void;
    show(tooltipModel: Model<TooltipOption>, nearPointColor: ZRColor): void;
    setContent(content: string | HTMLElement | HTMLElement[], markers: unknown, tooltipModel: Model<TooltipOption>, borderColor?: ZRColor, arrowPosition?: TooltipOption['position']): void;
    setEnterable(enterable: boolean): void;
    getSize(): number[];
    moveTo(zrX: number, zrY: number): void;
    /**
     * when `alwaysShowContent` is true,
     * move the tooltip after chart resized
     */
    _moveIfResized(): void;
    hide(): void;
    hideLater(time?: number): void;
    isShow(): boolean;
    dispose(): void;
}
export default TooltipHTMLContent;
