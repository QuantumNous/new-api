export default class Event {
    _eventMap = new Map();

    on(event: any, callback: any) {
        if (event && typeof callback === 'function') {
            this._eventMap.has(event) || this._eventMap.set(event, []);

            this._eventMap.get(event).push(callback);
        }
        return this;
    }

    once(event: any, callback: any) {
        if (event && typeof callback === 'function') {
            const fn = (...args: any) => {
                callback(...args);
                this.off(event, fn);
            };

            this.on(event, fn);
        }
    }

    off(event: any, callback: any) {
        if (event) {
            if (typeof callback === 'function') {
                const callbacks = this._eventMap.get(event);
                if (Array.isArray(callbacks) && callbacks.length) {
                    let index = -1;
                    while ((index = callbacks.findIndex(cb => cb === callback)) > -1) {
                        callbacks.splice(index, 1);
                    }
                }
            } else if (callback == null) {
                this._eventMap.delete(event);
            }
        }
        return this;
    }

    emit(event: any, ...args: any) {
        if (!this._eventMap.has(event)) {
            return false;
        }
        this._eventMap.get(event).forEach((callback: any) => callback(...args));
        return true;
    }
}
