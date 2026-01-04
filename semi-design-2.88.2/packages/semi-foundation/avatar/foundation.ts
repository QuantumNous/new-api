import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import warning from '../utils/warning';

export interface AvatarAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyImgState(isImgExist: boolean): void;
    notifyLeave(event: any): void;
    notifyEnter(event: any): void;
    setFocusVisible: (focusVisible: boolean) => void;
    setScale: (scale: number) => void;
    getAvatarNode: () => HTMLSpanElement
}

export default class AvatarFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<AvatarAdapter<P, S>, P, S> {

    constructor(adapter: AvatarAdapter<P, S>) {
        super({ ...adapter });
    }

    init() {
        const { children } = this.getProps();
        if (typeof children === "string") {
            this.changeScale();
        }
    }

    destroy() { }

    handleImgLoadError() {
        const { onError } = this.getProps();
        const errorFlag = onError ? onError() : undefined;
        if (errorFlag !== false) {
            this._adapter.notifyImgState(false);
        }
    }

    handleEnter(e: any) {
        this._adapter.notifyEnter(e);
    }

    handleLeave(e: any) {
        this._adapter.notifyLeave(e);
    }

    handleFocusVisible = (event: any) => {
        const { target } = event;
        try {
            if (target.matches(':focus-visible')) {
                this._adapter.setFocusVisible(true);
            }
        } catch (error) {
            warning(true, 'Warning: [Semi Avatar] The current browser does not support the focus-visible');
        }
    }

    handleBlur = () => {
        this._adapter.setFocusVisible(false);
    }

    changeScale = () => {
        const { gap } = this.getProps();
        const node = this._adapter.getAvatarNode();
        const stringNode = node?.firstChild as HTMLSpanElement;
        const [nodeWidth, stringNodeWidth] = [node?.offsetWidth || 0, stringNode?.offsetWidth || 0];
        if (nodeWidth !== 0 && stringNodeWidth !== 0 && gap * 2 < nodeWidth) {
            const scale = nodeWidth - gap * 2 > stringNodeWidth ? 1 : (nodeWidth - gap * 2) / stringNodeWidth;
            this._adapter.setScale(scale);
        }
    }
}
