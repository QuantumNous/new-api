/* eslint-disable @typescript-eslint/ban-types */
import React, { PureComponent, isValidElement } from 'react';
import PropTypes from 'prop-types';
import { Animation as SemiAnimation, events } from '@douyinfe/semi-animation';
import noop from './utils/noop';

export interface AnimationProps {
    onStart?: Function;
    onFrame?: Function;
    onPause?: Function;
    onResume?: Function;
    onStop?: Function;
    onRest?: Function;
    children?: React.ReactNode | ((AnimationChildProps?: any) => React.ReactNode);
    from?: Record<string, any>;
    to?: Record<string, any>;
    reverse?: boolean;
    reset?: boolean;
    force?: boolean;
    config?: Record<string, any>;
    autoStart?: boolean;
    forwardInstance?: (value: any) => void;
    immediate?: boolean
}

export default class Animation extends PureComponent<AnimationProps> {

    static propTypes = {
        onStart: PropTypes.func,
        onFrame: PropTypes.func,
        onPause: PropTypes.func,
        onResume: PropTypes.func,
        onStop: PropTypes.func,
        onRest: PropTypes.func,
        children: PropTypes.any,
        from: PropTypes.object,
        to: PropTypes.object,
        reverse: PropTypes.bool,
        reset: PropTypes.bool,
        force: PropTypes.bool,
        config: PropTypes.object,
        autoStart: PropTypes.bool,
        forwardInstance: PropTypes.func,
        immediate: PropTypes.bool,
    };

    static defaultProps = {
        autoStart: true,
        force: false,
        onStart: noop,
        onFrame: noop,
        onPause: noop,
        onResume: noop,
        onStop: noop,
        onRest: noop,
    };

    _mounted: boolean;
    _destroyed: boolean;
    animation: any;
    reverse: () => void;
    destroy: () => void;
    reset: () => void;
    resume: () => void;
    end: () => void;
    stop: () => void;
    pause: () => void;
    start: () => void;

    constructor(props = {}) {
        super(props);
        this.state = {
            currentStyle: {},
        };
        this._mounted = false;
        this._destroyed = false;
        this.initAnimation();
        this.bindEvents();
    }
    startOrNot() {
        throw new Error('Method not implemented.');
    }
    componentDidMount() {
        this._mounted = true;

        const { forwardInstance } = this.props;

        if (this.animation === null) {
            // didmount/willUnmount may be called twice when React.StrictMode is true in React 18, we need to ensure that this.animation is correct
            this.initAnimation();
            this.bindEvents();
        }

        if (typeof forwardInstance === 'function') {
            forwardInstance(this.animation);
        }

        this.startOrNot();

    }

    componentWillUnmount() {
        this._mounted = false;
        if (this.animation) {
            this.animation.destroy();
            this.animation = null;
        }
    }

    componentDidUpdate(prevProps: AnimationProps = {}) {
        if (this.props.reset) {
            if (this.props.from !== prevProps.from || this.props.to !== prevProps.to) {
                this.destroy();
                this.initAnimation();
                this.startOrNot();
            }
        }

        if (this.props.force) {
            if (this.props.to !== prevProps.to) {
                this.initAnimation({
                    ...this.props,
                    from: prevProps.to,
                });
                this.startOrNot();
            }
        }
    }

    initAnimation = (props?: AnimationProps) => {
        props = props == null ? this.props : props;
        let { from, to, config, reverse } = props;

        if (reverse) {
            [from, to] = [to, from];
        }

        this.animation = new SemiAnimation(
            {
                from: { ...from },
                to: { ...to },
            },
            {
                ...config,
            }
        );

        events.forEach((event: string) => {
            const propName = `on${event[0].toUpperCase() + event.slice(1)}`;
            // eslint-disable-next-line @typescript-eslint/no-shadow
            this.animation.on(event, (props: any) => {
                // avoid memory leak
                if (this._mounted && !this._destroyed) {
                    this.setState({
                        currentStyle: { ...props },
                    });
                    this.props[propName](props);
                }
            });
        });

        this._destroyed = false;
    };

    bindEvents = () => {
        this.startOrNot = () => {
            const { immediate, autoStart } = this.props;
            if (immediate) {
                this.end();
            } else if (autoStart) {
                this.start();
            }
        };
        this.start = () => {
            this.animation && this.animation.start();
        };
        this.pause = () => {
            this.animation && this.animation.pause();
        };
        this.stop = () => {
            this.animation && this.animation.stop();
        };
        this.end = () => {
            this.animation && this.animation.end();
        };
        this.resume = () => {
            this.animation && this.animation.resume();
        };
        this.reset = () => {
            if (this.animation) {
                this.animation.reset();
                this.startOrNot();
            }
        };
        this.reverse = () => {
            if (this.animation) {
                this.animation.reverse();
                this.startOrNot();
            }
        };
        this.destroy = () => {
            this._destroyed = true;
            this.animation && this.animation.destroy();
        };
    };

    render() {
        const { children } = this.props;
        if (typeof children === 'function') {
            return children(this.animation.getCurrentStates());
        } else if (isValidElement(children)) {
            return children;
        } else {
            return null;
        }
    }
}
