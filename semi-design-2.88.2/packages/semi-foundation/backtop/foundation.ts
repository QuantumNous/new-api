import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { Animation } from '@douyinfe/semi-animation';

export type BackTopClickEvent = any;

export type Target = any;

export interface BackTopAdapter extends DefaultAdapter {
    updateVisible: (visible: boolean) => void;
    notifyClick: (e: BackTopClickEvent) => void;
    targetIsWindow: (target: any) => boolean;
    isWindowUndefined: () => boolean;
    targetScrollToTop: (targetNode: any, scrollTop: number) => void
}

export default class BackTopFoundation extends BaseFoundation<BackTopAdapter> {
    animation!: any;
    constructor(adapter: BackTopAdapter) {
        super({ ...adapter });
    }

    init() {
        const { target } = this.getProps();
        const targetNode = target();
        if (!targetNode) {
            return;
        }
        targetNode.addEventListener('scroll', this.handleScroll);
        this.handleScroll();
    }

    destroy() {
        const { target } = this.getProps();
        const targetNode = target();
        targetNode && targetNode.removeEventListener('scroll', this.handleScroll);
        this.animation && this.animation.destroy();
    }

    getScroll(target: Target) {
        if (this._adapter.isWindowUndefined()) {
            return 0;
        }

        const prop = 'pageYOffset';
        const method = 'scrollTop';
        const isWindow = this._adapter.targetIsWindow(target);

        const scroll = isWindow ? target[prop] : target[method];

        return scroll;
    }

    scrollTo = (targetNode: Target, from: number, to: number) => {
        const { duration } = this.getProps();
        this.animation = new Animation(
            {
                from: { scrollTop: from },
                to: { scrollTop: to },
            },
            {
                duration,
                easing: 'easeInOutCubic'
            }
        );

        this.animation.on('frame', ({ scrollTop }: { scrollTop: number }) => {
            this._adapter.targetScrollToTop(targetNode, scrollTop);
        });

        this.animation.start();
    };

    setScrollTop(to: number) {
        const { target } = this.getProps();
        const targetNode = target();
        const from = this.getScroll(targetNode);
        this.scrollTo(targetNode, from, to);
    }

    handleScroll = () => {
        const { target, visibilityHeight } = this.getProps();
        const targetNode = target();
        const update = () => {
            const scrollTop = this.getScroll(targetNode);
            this._adapter.updateVisible(scrollTop > visibilityHeight);
        };
        requestAnimationFrame(update);
    };

    onClick(e: BackTopClickEvent) {
        this.setScrollTop(0);
        this._adapter.notifyClick(e);
    }
}
