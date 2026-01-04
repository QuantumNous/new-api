import { isObject, get } from 'lodash';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { numbers } from './constants';

export interface CarouselAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyChange: (activeIndex: number, preIndex: number) => void;
    setNewActiveIndex: (activeIndex: number) => void;
    setPreActiveIndex: (activeIndex: number) => void;
    setIsReverse: (isReverse: boolean) => void;   
    setIsInit: (isInit: boolean) => void;
    getChildren: () => any[]  
}

class CarouselFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<CarouselAdapter<P, S>, P, S> {

    constructor(adapter: CarouselAdapter<P, S>) {
        super({ ...adapter });
    }

    _interval = null;
    _forcePlay = false;

    setForcePlay(forcePlay: boolean) {
        this._forcePlay = forcePlay;
    }

    play(interval: number): void {
        if (this._interval) {
            clearInterval(this._interval);
        }
        this._interval = setInterval(() => {
            this.next();
        }, interval);
    }

    stop(): void {
        if (this._interval) {
            clearInterval(this._interval);
        }
    }

    goTo(activeIndex: number): void {
        const { activeIndex: stateActiveIndex } = this.getStates();
        const targetIndex = this.getValidIndex(activeIndex);
        this._adapter.setIsReverse(stateActiveIndex > targetIndex);
        if (this.getIsControlledComponent()) {
            this._notifyChange(targetIndex);
        } else {
            this._notifyChange(targetIndex);
            this.handleNewActiveIndex(targetIndex);
        }
    }

    next(): void {
        this.stop();
        const { activeIndex: stateActiveIndex } = this.getStates();
        const targetIndex = this.getValidIndex(stateActiveIndex + 1);
        this._adapter.setIsReverse(false);
        if (this.getIsControlledComponent()) {
            this._notifyChange(targetIndex);
        } else {
            this._notifyChange(targetIndex);
            this.handleNewActiveIndex(targetIndex);
        }
        this.handleAutoPlay();
    }

    prev(): void {
        this.stop();
        const { activeIndex: stateActiveIndex } = this.getStates();
        const targetIndex = this.getValidIndex(stateActiveIndex - 1);
        this._adapter.setIsReverse(true);
        if (this.getIsControlledComponent()) {
            this._notifyChange(targetIndex);
        } else {
            this._notifyChange(targetIndex);
            this.handleNewActiveIndex(targetIndex);
        }
        this.handleAutoPlay();
    }

    destroy(): void {
        this._unregisterInterval();
    }

    _unregisterInterval() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }


    _notifyChange(activeIndex: number): void {
        const { activeIndex: stateActiveIndex, isInit } = this.getStates();
        if (isInit) {
            this._adapter.setIsInit(false);
        }
        if (stateActiveIndex !== activeIndex) {
            this._adapter.setPreActiveIndex(stateActiveIndex);
            this._adapter.notifyChange(activeIndex, stateActiveIndex);
        }
    }

    getValidIndex(index: number): number {
        const children = this._adapter.getChildren();
        return (index + children.length) % children.length;
    }

    getSwitchingTime(): number {
        const { autoPlay, speed } = this.getProps(); 
        const autoPlayType = typeof autoPlay;
        if (autoPlayType === 'boolean') { 
            return numbers.DEFAULT_INTERVAL + speed;
        }
        if (isObject(autoPlay)) {
            return get(autoPlay, 'interval', numbers.DEFAULT_INTERVAL) + speed;
        }
        return speed;
    }

    getIsControlledComponent(): boolean {
        return this._isInProps('activeIndex');
    }

    handleAutoPlay(): void { 
        const { autoPlay } = this.getProps(); 
        const children = this._adapter.getChildren();
        const autoPlayType = typeof autoPlay;
        // when user manually call the play function, force play
        // only when carousel children length > 1 to start play
        if (children.length > 1 && ((autoPlay === true) || isObject(autoPlay) || this._forcePlay)) {
            this.play(this.getSwitchingTime());
        }
    }

    handleKeyDown(event: any): void {
        if (event.key === 'ArrowLeft') {
            this.prev();
        }
        if (event.key === 'ArrowRight') {
            this.next();
        }
    }

    onIndicatorChange(activeIndex: number): void {
        const { activeIndex: stateActiveIndex } = this.getStates();
        this._adapter.setIsReverse(stateActiveIndex > activeIndex);
        this._notifyChange(activeIndex);
        if (!this.getIsControlledComponent()) {
            this.handleNewActiveIndex(activeIndex);
        }
    }


    handleNewActiveIndex(activeIndex: number): void {
        const { activeIndex: stateActiveIndex } = this.getStates();
        if (stateActiveIndex !== activeIndex) {
            this._adapter.setNewActiveIndex(activeIndex);
        }
    }

    getDefaultActiveIndex(): number {
        let activeIndex;
        const props = this.getProps();
        if ('activeIndex' in props) {
            activeIndex = props.activeIndex;
        } else if ('defaultActiveIndex' in props) {
            activeIndex = props.defaultActiveIndex;
        }
        return activeIndex;
    }

}

export default CarouselFoundation;