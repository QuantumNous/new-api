import React, { Component } from 'react';
import PropTypes from 'prop-types';
import StyledAnimation, { StyledAnimationProps, StyledAnimateStyleType } from './StyledAnimation';
import noop from './utils/noop';

export interface ChildFCType {
    animateCls?: string;
    animateStyle?: StyledAnimateStyleType;
    animateEvents?: (eventProps?: any) => void
}

export interface StyledTransitionProps extends StyledAnimationProps {
    state?: string | boolean;
    enter?: string;
    leave?: string;
    children?: React.ReactNode | ((TransitionProps: ChildFCType) => React.ReactNode | any);
    willEnter?: (value: any) => void;
    didEnter?: (value: any) => void;
    willLeave?: (value: any) => void;
    didLeave?: (value: any) => void;
    onStart?: (value: any) => void;
    onRest?: (value: any) => void
}

export interface StyledTransitionState {
    state: string | boolean;
    lastChildren: React.ReactNode | ((TransitionProps: ChildFCType) => React.ReactNode | any);
    currentChildren: React.ReactNode | ((TransitionProps: ChildFCType) => React.ReactNode | any)
}

export default class StyledTransition extends Component<StyledTransitionProps, StyledTransitionState> {
    static propTypes = {
        state: PropTypes.string,
        enter: PropTypes.string,
        leave: PropTypes.string,
        children: PropTypes.any,
        willEnter: PropTypes.func,
        didEnter: PropTypes.func,
        willLeave: PropTypes.func,
        didLeave: PropTypes.func,
        onStart: PropTypes.func,
        onRest: PropTypes.func,
    };

    static defaultProps = {
        willEnter: noop,
        didEnter: noop,
        willLeave: noop,
        didLeave: noop,
        onStart: noop,
        onRest: noop,
    };

    constructor(props = {}) {
        super(props);

        this.state = {
            state: '',
            lastChildren: null,
            currentChildren: null,
        };
    }

    static getDerivedStateFromProps(props: StyledTransitionProps, state: StyledTransitionState) {
        const willUpdateStates: Partial<StyledTransitionState> = {};

        if (props.children !== state.currentChildren) {
            willUpdateStates.lastChildren = state.currentChildren;
            willUpdateStates.currentChildren = props.children;

            if (props.children == null) {
                willUpdateStates.state = 'leave';
            } else {
                willUpdateStates.state = 'enter';
            }
        }

        if (props.state != null && props.state !== state.state) {
            willUpdateStates.state = props.state;
        }

        return willUpdateStates;
    }

    _isControlled = () => [true, false, 'enter', 'leave'].includes(this.props.state);

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
        const { enter, leave, ...restProps } = this.props;
        const { currentChildren, lastChildren } = this.state;

        const isControlled = this._isControlled();

        let children, type;

        let { state } = this.state;

        if (isControlled) {
            children = this.props.children;
            state = this.props.state;
        } else if (currentChildren == null && lastChildren == null) {
            return null;
        }

        if (state === 'enter') {
            type = enter;

            if (!isControlled) {
                children = currentChildren;
            }
        } else if (state === 'leave') {
            type = leave;

            if (!isControlled) {
                children = lastChildren;
            }
        }

        return (
            <StyledAnimation {...restProps} type={type} onStart={this.onStart} onRest={this.onRest}>
                {children}
            </StyledAnimation>
        );
    }
}
