import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { isArray, get } from 'lodash';
import scrollIntoView, { CustomBehaviorOptions } from 'scroll-into-view-if-needed';
import { cssClasses } from './constants';

const prefixCls = cssClasses.PREFIX;

export interface AnchorAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    addLink: (link: string) => void;
    removeLink: (link: string) => void;
    setChildMap: (value: Record<string, Set<string>>) => void;
    setScrollHeight: (heigh: string) => void;
    setSlideBarTop: (height: number) => void;
    setClickLink: (value: boolean) => void;
    setActiveLink: (link: string, cb: () => void) => void;
    setClickLinkWithCallBack: (value: boolean, link: string, cb: (link: string) => void) => void;
    getContainer: () => HTMLElement | Window;
    getContainerBoundingTop: () => number;
    getLinksBoundingTop: () => number[];
    getAnchorNode: (selector: string) => HTMLElement;
    getContentNode: (selector: string) => HTMLElement;
    notifyChange: (currentLink: string, previousLink: string) => void;
    notifyClick: (e: any, link: string) => void;
    canSmoothScroll: () => boolean
}

export default class AnchorFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<AnchorAdapter<P, S>, P, S> {

    constructor(adapter: AnchorAdapter<P, S>) {
        super({ ...AnchorFoundation.defaultAdapter, ...adapter });
    }

    init = () => {};

    destroy = () => {};

    addLink = (link: string) => {
        this._adapter.addLink(link);
    };

    removeLink = (link: string) => {
        this._adapter.removeLink(link);
    };

    setActiveLink = (link: string, prevLink: string, shouldNotify = true) => {
        const activeLink = this._adapter.getState('activeLink');
        const onChange = this._adapter.getProp('onChange');
        if (activeLink !== link) {
            this._adapter.setActiveLink(link, this._setActiveSlide);
            if (onChange && shouldNotify) {
                this._adapter.notifyChange(link, prevLink);
            }
        }
    };

    // Adjust rail height according to text link content height
    setScrollHeight = () => {
        const anchorWrapper = `.${prefixCls}-link-wrapper`;
        const anchorNode = this._adapter.getAnchorNode(anchorWrapper);
        if (anchorNode) {
            const scrollHeight = `${anchorNode.scrollHeight}px`;
            this._adapter.setScrollHeight(scrollHeight);
        }
    };

    updateScrollHeight = (prevState: any, state: any) => {
        const prevLinks = prevState.links.join('');
        const links = state.links.join('');
        if (prevLinks !== links) {
            this.setScrollHeight();
        }
    };

    setChildMap = () => {
        const children = this._adapter.getProp('children');
        const childMap = {};
        if (isArray(children)) {
            for (const link of children) {
                this._getLinkToMap(link, [], childMap);
            }
        } else {
            this._getLinkToMap(children, [], childMap);
        }
        this._adapter.setChildMap(childMap);
    };

    updateChildMap = (prevState: any, state: any) => {
        const prevLinks = prevState.links.join('');
        const links = state.links.join('');
        if (prevLinks !== links) {
            this.setChildMap();
        }
    };

    getLinksTop = () => this._adapter.getLinksBoundingTop();

    handleScroll = () => {
        const { clickLink, links, activeLink: prevActiveLink } = this.getStates(); // TODO check this._adapter -> this.
        // ActiveLink Determined by the clicked link
        if (clickLink) {
            return;
        }
        const elTop = this.getLinksTop();
        let lastNegative = -Infinity;
        let lastNegativeIndex = -1;
        for (let i = 0; i < elTop.length; i++) {
            if (elTop[i] < 0 && elTop[i] > lastNegative) {
                lastNegative = elTop[i];
                lastNegativeIndex = i;
            }
        }
        const activeLink = links[lastNegativeIndex];
        this.setActiveLink(activeLink, prevActiveLink);
    };

    handleClick = (e: any, link: string, shouldNotify = true) => {
        const destNode = this._adapter.getContentNode(link);
        const prevLink = this._adapter.getState('activeLink');
        this.setActiveLink(link, prevLink, shouldNotify);
        if (destNode) {
            try {
                this._adapter.setClickLinkWithCallBack(true, link, this._scrollIntoView);
            } catch (error) {}
        }
        shouldNotify && this._adapter.notifyClick(e, link);
    };

    handleClickLink = () => {
        this._adapter.setClickLink(false);
    };

    // Get the child nodes of each link
    _getLinkToMap = (link: any, parents: string[], linkMap: { [key: string]: Set<string> }) => {
        const node = link && link.props;
        if (!node || !node.href) {
            return;
        }
        if (!(node.href in linkMap)) {
            linkMap[node.href] = new Set();
        }
        // Every ancestor kept a map
        for (const parent of parents) {
            linkMap[parent].add(node.href);
        }
        if (node.children && node.children.length) {
            parents.push(node.href);
            // Maintain child node map
            for (const child of node.children) {
                this._getLinkToMap(child, parents, linkMap);
            }
            parents.pop();
        }
    };

    _scrollIntoView = (link: string) => {
        const { scrollMotion, targetOffset } = this.getProps(); // TODO check this._adapter -> this.
        const behavior = scrollMotion ? 'smooth' : 'auto';
        const canSmoothScroll = this._adapter.canSmoothScroll();
        if (link) {
            const destNode = this._adapter.getContentNode(link);
            const scrollOpts: CustomBehaviorOptions<void> = {
                /**
                 * Behavior defines scrolling behavior
                 *  - Optional'auto '|' smooth '| Function
                 *  - Function Custom scrolling behavior
                 *    - Enter parameters as actions, each action contains an element that should be scrolled
                 *    - Actions include scrolling containers to the outermost scrollable container (document.body), the scrollable capacity needs to meet
                 *      1. The parent of the scroll container (directly or indirectly)
                 *      2. There is a scroll axis (clientHeight < scrollHeight | | clientWidth < scrollWidth)
                 *      3.overflowX or overflowY has a value and is not visible or clip
                 *       For details, please see https://github.com/stipsan/compute-scroll-into-view
                 *
                 * behavior定义滚动行为
                 *  - 可选 'auto' | 'smooth' | Function
                 *  - Function 自定义滚动行为
                 *    - 入参为 actions，每个action包含一个应该滚动的元素
                 *    - actions包括滚动容器到最外层的可滚动容器（document.body），可滚动容需满足
                 *      1. 滚动容器的父级（直接或间接）
                 *      2. 有滚动轴（clientHeight < scrollHeight || clientWidth < scrollWidth）
                 *      3. overflowX 或 overflowY 有值且不为 visible 或 clip
                 *      详情请看https://github.com/stipsan/compute-scroll-into-view
                 */
                behavior: actions => {
                    // We just need to scroll the innermost target container
                    const verticalScrollAction = actions.find(action => {
                        const { el } = action;
                        return el.scrollHeight > el.clientHeight;
                    });
                    const el = get(verticalScrollAction, 'el');
                    const top = get(verticalScrollAction, 'top');
                    if (el) {
                        const offsetTop = top - targetOffset;
                        if (el.scroll && canSmoothScroll) {
                            el.scroll({ top: offsetTop, behavior });
                        } else {
                            el.scrollTop = offsetTop;
                        }
                    }
                },
                block: 'start',
            };
            if (destNode) {
                scrollIntoView(destNode, scrollOpts);
            }
        }
    };

    _setActiveSlide = () => {
        const activeClass = `.${cssClasses.PREFIX}-link-title-active`;
        const linkNode = this._adapter.getAnchorNode(activeClass);
        if (linkNode) {
            const height = linkNode.offsetTop;
            this._adapter.setSlideBarTop(height);
        }
    };
}
