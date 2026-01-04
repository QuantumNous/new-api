import Event from './utils/Event';
import shouldStopAnimation from './shouldStopAnimation';
import shouldUseBezier from './shouldUseBezier';
import stripStyle from './stripStyle';
import stepper from './stepper';
import mapToZero from './mapToZero';
import wrapValue from './wrapValue';

const now = () => Date.now();

const msPerFrame = 1000 / 60;

/**
 * @summary
 *
 * Lifecycle hook:
 * start, pause, resume, stop, frame, rest
 *
 * Binding method:
 * const animation = new Animation (); animation.on ('start | frame | rest ', () => {});
 */
export default class Animation extends Event {
    _config: Record<string, any>;
    _props: Record<string, any>;
    _from: Record<string, any>;
    _to: Record<string, any>;
    _delay: number;
    _currentVelocity: Record<string, any>;
    _currentStyle: Record<string, any>;
    _lastIdealStyle: Record<string, any>;
    _lastIdealVelocity: Record<string, any>;
    _frameCount: number;
    _prevTime: number;
    _timer: any;
    _startedTime: number;
    _ended: boolean;
    _stopped: boolean;
    _wasAnimating: boolean;
    _started: boolean;
    _paused: boolean;
    _accumulatedTime: Record<string, any>;
    _pausedTime: number;
    _destroyed: boolean;
    constructor(props = {}, config = {}) {
        super();
        this._props = { ...props };
        this._config = { ...config };
        this.initStates();
    }

    _wrapConfig(object: { [x: string]: any }, config: { delay?: string }) {
        config = config && typeof config === 'object' ? config : this._config;
        const ret = {};
        for (const key of Object.keys(object)) {
            ret[key] = wrapValue(object[key], config);
        }
        return ret;
    }

    initStates(props?: Record<string, any>, config?: Record<string, any>) {
        props = props && typeof props === 'object' ? props : this._props;
        config = config && typeof config === 'object' ? config : this._config;

        const { from, to } = props;

        this._from = {};

        if (from && typeof from) {
            for (const key of Object.keys(from)) {
                this._from[key] = typeof from[key] === 'object' && from[key].val ? from[key].val : from[key];
            }
        }

        this._to = this._wrapConfig(to, config);

        this._delay = parseInt(config.delay) || 0;

        const currentStyle = (this._from && stripStyle(this._from)) || stripStyle(this._to);
        const currentVelocity = mapToZero(currentStyle);

        this._currentStyle = { ...currentStyle };
        this._currentVelocity = { ...currentVelocity };
        this._lastIdealStyle = { ...currentStyle };
        this._lastIdealVelocity = { ...currentVelocity };

        this.resetPlayStates();

        this._frameCount = 0;
        this._prevTime = 0;
    }

    animate() {
        if (this._timer != null) {
            return;
        }
        this._timer = requestAnimationFrame(timestamp => {
            const nowTime = now();

            // stop animation and emit onRest event
            if (
                shouldStopAnimation(
                    this._currentStyle,
                    this._to,
                    this._currentVelocity,
                    this._startedTime || nowTime,
                    nowTime
                ) ||
                this._ended ||
                this._stopped
            ) {
                if (this._wasAnimating && !this._ended && !this._stopped) {
                    // should emit reset in settimeout for delay msPerframe
                    this._timer = setTimeout(() => {
                        clearTimeout(this._timer);
                        this._timer = null;
                        this._ended = true;
                        this.emit('rest', this.getCurrentStates());
                    }, msPerFrame);
                }
                this.resetPlayStates();
                return;
            }

            if (!this._started) {
                this._started = true;
                this.emit('start', this.getCurrentStates());
            }

            this._stopped = false;
            this._paused = false;
            this._wasAnimating = true;

            if (this._startedTime === 0) {
                this._startedTime = nowTime;
            }

            const currentTime = nowTime;
            const timeDelta = currentTime - this._prevTime;
            this._prevTime = currentTime;

            if (currentTime - this._startedTime < this._delay) {
                this._timer = null;
                this.animate();
            }

            const newLastIdealStyle = {};
            const newLastIdealVelocity = {};
            const newCurrentStyle = {};
            const newCurrentVelocity = {};

            const toKeys = (this._to && Object.keys(this._to)) || [];
            for (const key of toKeys) {
                const styleValue = this._to[key];
                this._accumulatedTime[key] =
                    typeof this._accumulatedTime[key] !== 'number' ? timeDelta : this._accumulatedTime[key] + timeDelta;

                const from =
                    this._from[key] != null && typeof this._from[key] === 'object'
                        ? this._from[key].val
                        : this._from[key];

                const to = styleValue.val;

                if (typeof styleValue === 'number') {
                    newCurrentStyle[key] = styleValue;
                    newCurrentVelocity[key] = 0;
                    newLastIdealStyle[key] = styleValue;
                    newLastIdealVelocity[key] = 0;
                } else {
                    let newLastIdealStyleValue = this._lastIdealStyle[key];
                    let newLastIdealVelocityValue = this._lastIdealVelocity[key];

                    if (shouldUseBezier(this._config) || shouldUseBezier(styleValue)) {
                        // easing
                        const { easing, duration } = styleValue;
                        newLastIdealStyleValue =
                            from + easing((currentTime - this._startedTime) / duration) * (to - from);

                        if (currentTime >= this._startedTime + duration) {
                            newLastIdealStyleValue = to;
                            styleValue.done = true;
                        }

                        newLastIdealStyle[key] = newLastIdealStyleValue;
                        newCurrentStyle[key] = newLastIdealStyleValue;
                    } else if (to != null && to === this._currentStyle[key]) {
                        newCurrentStyle[key] = to;
                        newCurrentVelocity[key] = 0;
                        newLastIdealStyle[key] = to;
                        newLastIdealVelocity[key] = 0;
                    } else {
                        // spring
                        const currentFrameCompletion =
                            (this._accumulatedTime[key] -
                                Math.floor(this._accumulatedTime[key] / msPerFrame) * msPerFrame) /
                            msPerFrame;
                        const framesToCatchUp = Math.floor(this._accumulatedTime[key] / msPerFrame);

                        for (let i = 0; i < framesToCatchUp; i++) {
                            [newLastIdealStyleValue, newLastIdealVelocityValue] = stepper(
                                msPerFrame / 1000,
                                newLastIdealStyleValue,
                                newLastIdealVelocityValue,
                                styleValue.val,
                                styleValue.tension,
                                styleValue.friction,
                                styleValue.precision
                            );
                        }
                        const [nextIdealX, nextIdealV] = stepper(
                            msPerFrame / 1000,
                            newLastIdealStyleValue,
                            newLastIdealVelocityValue,
                            styleValue.val,
                            styleValue.tension,
                            styleValue.friction,
                            styleValue.precision
                        );

                        newCurrentStyle[key] =
                            newLastIdealStyleValue + (nextIdealX - newLastIdealStyleValue) * currentFrameCompletion;
                        newCurrentVelocity[key] =
                            newLastIdealVelocityValue +
                            (nextIdealV - newLastIdealVelocityValue) * currentFrameCompletion;
                        newLastIdealStyle[key] = newLastIdealStyleValue;
                        newLastIdealVelocity[key] = newLastIdealVelocityValue;
                        this._accumulatedTime[key] -= framesToCatchUp * msPerFrame;
                    }
                }
            }

            this._timer = null;

            this._currentStyle = { ...newCurrentStyle };
            this._currentVelocity = { ...newCurrentVelocity };
            this._lastIdealStyle = { ...newLastIdealStyle };
            this._lastIdealVelocity = { ...newLastIdealVelocity };

            // console.log(newCurrentStyle);

            if (!this._destroyed) {
                this.emit('frame', this.getCurrentStates());
                this.animate();
            }
        });
    }

    start() {
        this._prevTime = now();
        this._startedTime = now();
        this.animate();
    }

    end() {
        if (!this._ended) {
            this._ended = true;
            this._currentStyle = this.getFinalStates();
            this.emit('frame', this.getFinalStates());
            this.emit('rest', this.getFinalStates());
        }
        this.destroy();
    }

    pause() {
        if (!this._paused) {
            this._pausedTime = now();
            this._paused = true;
            this.emit('pause', this.getCurrentStates());
            this.destroy();
            this._destroyed = false;
        }
    }

    resume() {
        if (this._started && this._paused) {
            const nowTime = now();
            const pausedDuration = nowTime - this._pausedTime;
            this._paused = false;
            // should add with pausedDuration
            this._startedTime += pausedDuration;
            this._prevTime += pausedDuration;
            this._pausedTime = 0;
            this.emit('resume', this.getCurrentStates());
            this.animate();
        }
    }

    stop() {
        this.destroy();
        if (!this._stopped) {
            this._stopped = true;
            // this.emit('frame', this.getInitialStates());
            this.emit('stop', this.getInitialStates());
            this.initStates();
        }
    }

    destroy() {
        cancelAnimationFrame(this._timer);
        clearTimeout(this._timer);
        this._timer = null;
        this._destroyed = true;
    }

    resetPlayStates() {
        this._started = false;
        this._stopped = false;
        this._ended = false;
        this._paused = false;
        this._destroyed = false;
        this._timer = null;
        this._wasAnimating = false;
        this._accumulatedTime = {};
        this._startedTime = 0;
        this._pausedTime = 0;
    }

    reset() {
        this.destroy();
        this.initStates();
    }

    reverse() {
        this.destroy();
        const props = { ...this._props };
        const [from, to] = [props.to, props.from];
        props.from = from;
        props.to = to;
        this._props = { ...props };
        this.initStates();
    }

    getCurrentStates() {
        return { ...this._currentStyle };
    }

    getInitialStates() {
        return { ...stripStyle(this._props.from) };
    }

    getFinalStates() {
        return { ...stripStyle(this._props.to) };
    }
}
