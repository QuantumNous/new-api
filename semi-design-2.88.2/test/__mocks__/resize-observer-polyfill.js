export default class ResizeObserver {
    constructor(callback) {
        this._callback = callback;
        this._callbackCtx_ = this;
        window.addEventListener('resize', this._callback.bind(this._callbackCtx));
    }
    observe() {
        this._callback && this._callback.call(this._callbackCtx);
    }
    unobserve() {
    }
    disconnect() {
    }
}

