import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { numbers } from './constants';

export interface UserGuideAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S>{
    notifyChange: (current: number) => void;
    notifyPrev: (current: number) => void;
    notifyNext: (current: number) => void;
    notifySkip: () => void;
    notifyFinish: () => void;
    setCurrent: (current: number) => void;
    disabledBodyScroll: () => void;
    enabledBodyScroll: () => void
}


export default class UserGuideFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<UserGuideAdapter<P, S>, P, S> {
    constructor(adapter: UserGuideAdapter<P, S>) {
        super({ ...adapter });
    }

    init() {
    }

    destroy() {
        this._adapter.enabledBodyScroll();
    }

    _notifyChange(current: number): void {
        const { current: stateCurrent } = this.getStates();
        if (stateCurrent !== current) {
            this._adapter.notifyChange(current);
        }
    }

    getIsControlledComponent(): boolean {
        return this._isInProps('current');
    }

    beforeShow() {
        this._adapter.disabledBodyScroll();
    }

    afterHide() {
        this._adapter.enabledBodyScroll();
    }

    getFinalPaading() {
        const { spotlightPadding, steps } = this.getProps();
        const { current } = this.getStates();
        const stepPadding = steps[current]?.spotlightPadding;
        const padding = typeof stepPadding === 'number' ? stepPadding : 
            typeof spotlightPadding === 'number' ? spotlightPadding : 
                numbers.DEFAULT_SPOTLIGHT_PADDING;
        return padding;
    }

    handlePrev = () => {
        const { current } = this.getStates();
        const newCurrent = current - 1;
        if (!this.getIsControlledComponent()) {
            this._adapter.setCurrent(newCurrent);
        } 
        this._notifyChange(newCurrent);
        this._adapter.notifyPrev(newCurrent);
    };

    handleNext = () => {
        const { steps } = this.getProps();
        const { current } = this.getStates();
        const isLastStep = current === steps.length - 1;
        const newCurrent = isLastStep ? current : current + 1;
        if (isLastStep) {
            this._adapter.notifyFinish();
        } else {
            this._notifyChange(newCurrent);
            this._adapter.notifyNext(newCurrent);
            if (!this.getIsControlledComponent()) {
                this._adapter.setCurrent(newCurrent);
            }
        }
    };

    handleSkip = () => {
        this._adapter.notifySkip();
    };

} 