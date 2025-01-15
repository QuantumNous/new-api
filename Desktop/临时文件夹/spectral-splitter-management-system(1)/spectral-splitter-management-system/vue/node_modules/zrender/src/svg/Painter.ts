/**
 * SVG Painter
 */

import {
    brush, setClipPath
} from './graphic';
import Displayable from '../graphic/Displayable';
import Storage from '../Storage';
import { PainterBase } from '../PainterBase';
import {
    createElement,
    createVNode,
    vNodeToString,
    SVGVNodeAttrs,
    SVGVNode,
    getCssString,
    BrushScope,
    createBrushScope,
    createSVGVNode
} from './core';
import { normalizeColor, encodeBase64 } from './helper';
import { extend, keys, logError, map, retrieve2 } from '../core/util';
import Path from '../graphic/Path';
import patch, { updateAttrs } from './patch';
import { getSize } from '../canvas/helper';

let svgId = 0;

interface SVGPainterOption {
    width?: number
    height?: number
    ssr?: boolean
}

class SVGPainter implements PainterBase {

    type = 'svg'

    storage: Storage

    root: HTMLElement

    private _svgDom: SVGElement
    private _viewport: HTMLElement

    private _opts: SVGPainterOption

    private _oldVNode: SVGVNode
    private _bgVNode: SVGVNode
    private _mainVNode: SVGVNode

    private _width: number
    private _height: number

    private _backgroundColor: string

    private _id: string

    constructor(root: HTMLElement, storage: Storage, opts: SVGPainterOption) {
        this.storage = storage;
        this._opts = opts = extend({}, opts);

        this.root = root;
        // A unique id for generating svg ids.
        this._id = 'zr' + svgId++;

        this._oldVNode = createSVGVNode(opts.width, opts.height);

        if (root && !opts.ssr) {
            const viewport = this._viewport = document.createElement('div');
            viewport.style.cssText = 'position:relative;overflow:hidden';
            const svgDom = this._svgDom = this._oldVNode.elm = createElement('svg');
            updateAttrs(null, this._oldVNode);
            viewport.appendChild(svgDom);
            root.appendChild(viewport);
        }

        this.resize(opts.width, opts.height);
    }

    getType() {
        return this.type;
    }

    getViewportRoot() {
        return this._viewport;
    }
    getViewportRootOffset() {
        const viewportRoot = this.getViewportRoot();
        if (viewportRoot) {
            return {
                offsetLeft: viewportRoot.offsetLeft || 0,
                offsetTop: viewportRoot.offsetTop || 0
            };
        }
    }

    getSvgDom() {
        return this._svgDom;
    }

    refresh() {
        if (this.root) {
            const vnode = this.renderToVNode({
                willUpdate: true
            });
            // Disable user selection.
            vnode.attrs.style = 'position:absolute;left:0;top:0;user-select:none';
            patch(this._oldVNode, vnode);
            this._oldVNode = vnode;
        }
    }

    renderOneToVNode(el: Displayable) {
        return brush(el, createBrushScope(this._id));
    }

    renderToVNode(opts?: {
        animation?: boolean
        willUpdate?: boolean
        compress?: boolean,
        useViewBox?: boolean
    }) {

        opts = opts || {};

        const list = this.storage.getDisplayList(true);
        const bgColor = this._backgroundColor;
        const width = this._width;
        const height = this._height;

        const scope = createBrushScope(this._id);
        scope.animation = opts.animation;
        scope.willUpdate = opts.willUpdate;
        scope.compress = opts.compress;

        const children: SVGVNode[] = [];

        if (bgColor && bgColor !== 'none') {
            const { color, opacity } = normalizeColor(bgColor);
            this._bgVNode = createVNode(
                'rect',
                'bg',
                {
                    width: width,
                    height: height,
                    x: '0',
                    y: '0',
                    id: '0',
                    fill: color,
                    'fill-opacity': opacity
                }
            );
            children.push(this._bgVNode);
        }
        else {
            this._bgVNode = null;
        }

        // Ignore the root g if wan't the output to be more tight.
        const mainVNode = !opts.compress
            ? (this._mainVNode = createVNode('g', 'main', {}, [])) : null;
        this._paintList(list, scope, mainVNode ? mainVNode.children : children);
        mainVNode && children.push(mainVNode);

        const defs = map(keys(scope.defs), (id) => scope.defs[id]);
        if (defs.length) {
            children.push(createVNode('defs', 'defs', {}, defs));
        }

        if (opts.animation) {
            const animationCssStr = getCssString(scope.cssNodes, scope.cssAnims, { newline: true });
            if (animationCssStr) {
                const styleNode = createVNode('style', 'stl', {}, [], animationCssStr);
                children.push(styleNode);
            }
        }

        return createSVGVNode(width, height, children, opts.useViewBox);
    }

    renderToString(opts?: {
        /**
         * If add css animation.
         * @default true
         */
        cssAnimation?: boolean
        /**
         * If use viewBox
         * @default true
         */
        useViewBox?: boolean
    }) {
        opts = opts || {};
        return vNodeToString(this.renderToVNode({
            animation: retrieve2(opts.cssAnimation, true),
            willUpdate: false,
            compress: true,
            useViewBox: retrieve2(opts.useViewBox, true)
        }), { newline: true });
    }

    setBackgroundColor(backgroundColor: string) {
        this._backgroundColor = backgroundColor;
        const bgVNode = this._bgVNode;
        if (bgVNode && bgVNode.elm) {
            const { color, opacity } = normalizeColor(backgroundColor);
            (bgVNode.elm as SVGElement).setAttribute('fill', color);
            if (opacity < 1) {
                (bgVNode.elm as SVGElement).setAttribute('fill-opacity', opacity as any);
            }
        }
    }

    getSvgRoot() {
        return this._mainVNode && this._mainVNode.elm as SVGElement;
    }

    _paintList(list: Displayable[], scope: BrushScope, out?: SVGVNode[]) {
        const listLen = list.length;

        const clipPathsGroupsStack: SVGVNode[] = [];
        let clipPathsGroupsStackDepth = 0;
        let currentClipPathGroup;
        let prevClipPaths: Path[];
        let clipGroupNodeIdx = 0;
        for (let i = 0; i < listLen; i++) {
            const displayable = list[i];
            if (!displayable.invisible) {
                const clipPaths = displayable.__clipPaths;
                const len = clipPaths && clipPaths.length || 0;
                const prevLen = prevClipPaths && prevClipPaths.length || 0;
                let lca;
                // Find the lowest common ancestor
                for (lca = Math.max(len - 1, prevLen - 1); lca >= 0; lca--) {
                    if (clipPaths && prevClipPaths
                        && clipPaths[lca] === prevClipPaths[lca]
                    ) {
                        break;
                    }
                }
                // pop the stack
                for (let i = prevLen - 1; i > lca; i--) {
                    clipPathsGroupsStackDepth--;
                    // svgEls.push(closeGroup);
                    currentClipPathGroup = clipPathsGroupsStack[clipPathsGroupsStackDepth - 1];
                }
                // Pop clip path group for clipPaths not match the previous.
                for (let i = lca + 1; i < len; i++) {
                    const groupAttrs: SVGVNodeAttrs = {};
                    setClipPath(
                        clipPaths[i],
                        groupAttrs,
                        scope
                    );
                    const g = createVNode(
                        'g',
                        'clip-g-' + clipGroupNodeIdx++,
                        groupAttrs,
                        []
                    );
                    (currentClipPathGroup ? currentClipPathGroup.children : out).push(g);
                    clipPathsGroupsStack[clipPathsGroupsStackDepth++] = g;
                    currentClipPathGroup = g;
                }
                prevClipPaths = clipPaths;

                const ret = brush(displayable, scope);
                if (ret) {
                    (currentClipPathGroup ? currentClipPathGroup.children : out).push(ret);
                }
            }
        }
    }

    resize(width: number, height: number) {
        // Save input w/h
        const opts = this._opts;
        const root = this.root;
        const viewport = this._viewport;
        width != null && (opts.width = width);
        height != null && (opts.height = height);

        if (root && viewport) {
            // FIXME Why ?
            viewport.style.display = 'none';

            width = getSize(root, 0, opts);
            height = getSize(root, 1, opts);

            viewport.style.display = '';
        }

        if (this._width !== width || this._height !== height) {
            this._width = width;
            this._height = height;

            if (viewport) {
                const viewportStyle = viewport.style;
                viewportStyle.width = width + 'px';
                viewportStyle.height = height + 'px';
            }

            const svgDom = this._svgDom;
            if (svgDom) {
                // Set width by 'svgRoot.width = width' is invalid
                svgDom.setAttribute('width', width as any);
                svgDom.setAttribute('height', height as any);
            }
        }
    }

    /**
     * 获取绘图区域宽度
     */
    getWidth() {
        return this._width;
    }

    /**
     * 获取绘图区域高度
     */
    getHeight() {
        return this._height;
    }

    dispose() {
        if (this.root) {
            this.root.innerHTML = '';
        }

        this._svgDom =
        this._viewport =
        this.storage =
        this._oldVNode =
        this._bgVNode =
        this._mainVNode = null;
    }
    clear() {
        if (this._svgDom) {
            this._svgDom.innerHTML = null;
        }
        this._oldVNode = null;
    }
    toDataURL(base64?: boolean) {
        let str = encodeURIComponent(this.renderToString());
        const prefix = 'data:image/svg+xml;';
        if (base64) {
            str = encodeBase64(str);
            return str && prefix + 'base64,' + str;
        }
        return prefix + 'charset=UTF-8,' + str;
    }

    refreshHover = createMethodNotSupport('refreshHover') as PainterBase['refreshHover'];
    configLayer = createMethodNotSupport('configLayer') as PainterBase['configLayer'];
}


// Not supported methods
function createMethodNotSupport(method: string): any {
    return function () {
        if (process.env.NODE_ENV !== 'production') {
            logError('In SVG mode painter not support method "' + method + '"');
        }
    };
}


export default SVGPainter;
