/* istanbul ignore next */
class Store<T = Record<string, any>> {
    _state: T;
    _listeners: any[];
    constructor(initialState: T) {
        this._state = { ...initialState };
        this._listeners = [];
    }

    subscribe(listener: (state: T) => () => void) {
        this._listeners.push(listener);
        const unsubscribe = () => {
            const index = this._listeners.indexOf(listener);

            if (index > -1) {
                this._listeners.splice(index, 1);
            }
        };
        return unsubscribe;
    }

    setState(state: T) {
        Object.assign(this._state, { ...state });

        for (const listener of this._listeners) {
            if (typeof listener === 'function') {
                listener(this._state);
            }
        }
    }

    getState() {
        return this._state;
    }
}

export default Store;
