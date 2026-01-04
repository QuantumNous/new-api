/**
 * The Semi Foundation / Adapter architecture split was inspired by Material Component For Web. （https://github.com/material-components/material-components-web）
 * We re-implemented our own code based on the principle and added more functions we need according to actual needs.
 * 
 */
 
import log from '../utils/log';
import { noop } from 'lodash';

export type noopFunction = (...args: any) => any;
export interface DefaultAdapter<P = Record<string, any>, S = Record<string, any>> {
    getContext(key: string): any;
    getContexts(): any;
    getProp(key: string): any;
    getProps(): P;
    getState(key: string): any;
    getStates(): S;
    setState<K extends keyof S>(s: Pick<S, K>, callback?: any): void;
    getCache(c: string): any;
    getCaches(): any;
    setCache(key: any, value: any): void;
    stopPropagation(e: any): void;
    persistEvent: (event: any) => void
}

class BaseFoundation<T extends Partial<DefaultAdapter<P, S>>, P = Record<string, any>, S = Record<string, any>> {
    /** @return enum{css className} */
    /* istanbul ignore next */
    static get cssClasses() {
        // Classes extending Foundation should implement this method to return an object which exports every
        // CSS class the foundation class needs as a property. e.g. {ACTIVE: 'component--active'}
        return {};
    }

    /** @return enum{strings} */
    /* istanbul ignore next */
    static get strings() {
        // Classes extending Foundation should implement this method to return an object which exports all
        // semantic strings as constants. e.g. {ARIA_ROLE: 'tablist'}
        return {};
    }

    /** @return enum{numbers} */
    /* istanbul ignore next */
    static get numbers() {
        // Classes extending Foundation should implement this method to return an object which exports all
        // of its semantic numbers as constants. e.g. {ANIMATION_DELAY_MS: 350}
        return {};
    }

    static get defaultAdapter() {
        return {
            getProp: noop,
            getProps: noop,
            getState: noop,
            getStates: noop,
            setState: noop,
            getContext: noop,
            getContexts: noop,
            getCache: noop,
            setCache: noop,
            getCaches: noop,
            stopPropagation: noop,
            persistEvent: noop,
        };
    }

    _adapter!: T;

    constructor(adapter: T) {
        this._adapter = { ...BaseFoundation.defaultAdapter, ...adapter };
    }

    getProp(key: string) {
        return this._adapter.getProp(key);
    }

    getProps(): any {
        return this._adapter.getProps() as any;
    }

    getState(key: string) {
        return this._adapter.getState(key);
    }

    getStates(): any {
        return this._adapter.getStates();
    }

    setState<K extends keyof S>(states: Pick<S, K>, cb?: (...args: any) => void) {
        return this._adapter.setState({ ...states }, cb);
    }

    getContext(key: string) {
        return this._adapter.getContext(key);
    }

    /* istanbul ignore next */
    getContexts() {
        return this._adapter.getContexts();
    }

    /* istanbul ignore next */
    getCaches() {
        return this._adapter.getCaches();
    }

    getCache(key: string) {
        return this._adapter.getCache(key);
    }

    setCache(key: string, value: any) {
        return key && this._adapter.setCache(key, value);
    }

    stopPropagation(e: any) {
        this._adapter.stopPropagation(e);
    }

    // Determine whether a controlled component
    _isControlledComponent(key: string = 'value') { // eslint-disable-line
        const props = this.getProps();
        const isControlComponent = key in (props as any);
        return isControlComponent;
    }

    // Does the user have incoming props, eg: _isInProps (value)
    _isInProps(key: string) { // eslint-disable-line
        const props = this.getProps();
        return key in (props as any);
    }

    init(lifecycle?: any) {
        // Subclasses should override this method to perform initialization routines (registering events, etc.)
    }

    destroy() {
        // Subclasses should override this method to perform de-initialization routines (de-registering events, etc.)
    }

    /* istanbul ignore next */
    log(text: string, ...rest: any) {
        log(text, ...rest);
    }

    _persistEvent(e: any) {
        // only work for react adapter for now
        this._adapter.persistEvent(e);
    }
}
export default BaseFoundation;
