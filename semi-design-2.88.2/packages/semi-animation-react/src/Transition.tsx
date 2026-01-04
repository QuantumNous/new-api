import Animation, { AnimationProps } from './Animation';
import PropTypes from 'prop-types';
import React, { Component, isValidElement } from 'react';
import noop from './utils/noop';

export interface TransitionProps extends AnimationProps {
    children?: React.ReactNode | ((TransitionProps: any) => any);
    from?: Record<string, any>;
    enter?: Record<string, any>;
    leave?: Record<string, any>;
    state?: string | boolean;
    willEnter?: (value: any) => void;
    didEnter?: (value: any) => void;
    willLeave?: (value: any) => void;
    didLeave?: (value: any) => void;
    onRest?: (value: any) => void;
    onStart?: (value: any) => void
}

export interface TransitionState {
    state: string | boolean;
    lastChildren: React.ReactNode | ((TransitionProps: any) => React.ReactNode | any);
    currentChildren: React.ReactNode | ((TransitionProps: any) => React.ReactNode | any)
}

export default class Transition extends Component<TransitionProps, TransitionState> {
    static propTypes = {
        children: PropTypes.any,
        from: PropTypes.object,
        enter: PropTypes.object,
        leave: PropTypes.object,
        willEnter: PropTypes.func,
        didEnter: PropTypes.func,
        willLeave: PropTypes.func,
        didLeave: PropTypes.func,
        state: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    };

    static defaultProps = {
        willEnter: noop,
        didEnter: noop,
        willLeave: noop,
        didLeave: noop,
        onStart: noop,
        onRest: noop,
    };
    instance: any;

    constructor(props = {}) {
        super(props);

        this.state = {
            state: '',
            lastChildren: null,
            currentChildren: null,
        };
    }

    static getDerivedStateFromProps(props: TransitionProps, state: TransitionState) {
        const willUpdateStates: Partial<TransitionState> = {};

        if (
            props.children !== state.currentChildren
            // && (props.children == null || state.currentChildren == null)
        ) {
            willUpdateStates.lastChildren = state.currentChildren;
            willUpdateStates.currentChildren = props.children;

            if (props.children == null) {
                willUpdateStates.state = 'leave';
            } else {
                willUpdateStates.state = 'enter';
            }
        }

        if (props.state != null) {
            willUpdateStates.state = props.state;
        }

        return willUpdateStates;
    }

    componentWillUnmount() {
        if (this.instance) {
            this.instance.destroy();
            this.instance = null;
        }
    }

    _isControlled = () => [true, false, 'enter', 'leave'].includes(this.props.state);

    forwardInstance = (instance: any) => {
        this.instance = instance;
    };

    onRest = (props: any) => {
        const { state } = this.state;

        if (state === 'enter') {
            this.props.didEnter(props);
        } else if (state === 'leave') {
            this.setState({ currentChildren: null, lastChildren: null });
            this.props.didLeave(props);
        }

        this.props.onRest(props);
    };

    onStart = (props: any) => {
        const { state } = this.state;

        if (state === 'enter') {
            this.props.willEnter(props);
        } else if (state === 'leave') {
            this.props.willLeave(props);
        }

        this.props.onStart(props);
    };

    render() {
        const { from: propsFrom, enter, leave, ...restProps } = this.props;

        let children;

        let { currentChildren, lastChildren, state } = this.state;

        let from = {};
        let to = {};

        const isControlled = this._isControlled();

        if (isControlled) {
            children = this.props.children;
            state = this.props.state;
        } else if (currentChildren == null && lastChildren == null) {
            return null;
        }

        if (state === 'enter') {
            from = propsFrom;
            to = enter;

            if (!isControlled) {
                children = currentChildren;
            }
        } else if (state === 'leave') {
            from = enter;
            to = leave;

            if (!isControlled) {
                children = lastChildren;
            }
        }

        return (
            <Animation {...restProps} force from={from} to={to} onRest={this.onRest} onStart={this.onStart}>
                {
                    (props: Record<string, any>) => (
                        // eslint-disable-next-line no-nested-ternary
                        typeof children === 'function' ?
                            children(props) :
                            isValidElement(children) ?
                                children :
                                null)
                }
            </Animation>
        );
    }
}
