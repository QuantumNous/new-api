class Logger {
    _prefix: string;
    /**
     * specify prefix
     * @param {string} prefix
     */
    constructor(prefix: string) {
        this._prefix = prefix;
    }

    _isEmpty(value: any) {
        return value === null || value === undefined || value === '';
    }

    _baseLog(method = 'log', ...args: any[]) {
        if (typeof console[method] === 'function') {
            const messages = [...args];

            if (!this._isEmpty(this._prefix)) {
                messages.unshift(this._prefix, ':');
            }

            console[method](...messages);
        }
    }

    /* istanbul ignore next */
    log(...args: any[]) {
        this._baseLog('log', ...args);
    }

    /* istanbul ignore next */
    warn(...args: any[]) {
        this._baseLog('warn', ...args);
    }

    /* istanbul ignore next */
    error(...args: any[]) {
        this._baseLog('error', ...args);
    }

    /* istanbul ignore next */
    info(...args: any[]) {
        this._baseLog('info', ...args);
    }
}

export default Logger;
