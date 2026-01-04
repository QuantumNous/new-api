import React, { Component, isValidElement } from 'react';
import PropTypes from 'prop-types';
import noop from './utils/noop';
import Animation from './Animation';

export interface KeyFramesProps {
    frames?: any[];
    loop?: boolean;
    children?: React.ReactNode | ((KeyFramesProps: any) => React.ReactNode);
    forwardInstance?: (value: any) => void;
    onFrame?: (value: any) => void;
    onKeyRest?: (value: Record<string, any>) => void;
    onRest?: (value: Record<string, any>) => void
}

export interface KeyFramesStates {
    currentStyle: Record<string, any>;
    frameIndex: number
}

export default class KeyFrames extends Component<KeyFramesProps, KeyFramesStates> {
    static propTypes = {
        frames: PropTypes.array,
        loop: PropTypes.bool,
        onFrame: PropTypes.func,
        onKeyRest: PropTypes.func,
        onRest: PropTypes.func,
    };

    static defaultProps = {
        frames: [] as any[],
        loop: false,
        onKeyRest: noop,
        onRest: noop,
        onFrame: noop,
    };
    instance: any;

    constructor(props = {}) {
        super(props);

        this.state = {
            currentStyle: {},
            frameIndex: 0,
        };
    }

    onFrame = (props = {}) => {
        const currentStyle = { ...props };

        this.props.onFrame(currentStyle);
        this.setState({ currentStyle });
    };

    next = () => {
        let { frameIndex } = this.state;
        const { frames, loop } = this.props;

        frameIndex++;

        if (frameIndex < frames.length - 1) {
            this.setState({ frameIndex });
        } else {
            frameIndex = 0;
            this.props.onRest(this.state.currentStyle);

            if (loop) {
                this.setState({ frameIndex });
            }
        }

        this.props.onKeyRest(this.state.currentStyle);
    };

    forwardInstance = (instance: any) => {
        this.instance = instance;

        if (typeof this.props.forwardInstance === 'function') {
            this.props.forwardInstance(this.instance);
        }
    };

    componentDidMount() {
        // this.props.forwardInstance(this.instance);
    }

    componentWillUnmount() {
        this.instance && this.instance.destroy();
    }

    render() {
        const { children, frames } = this.props;

        const { frameIndex, currentStyle } = this.state;

        const from = frames[frameIndex];
        const to = frames[frameIndex + 1];

        return (
            <Animation
                {...this.props}
                forwardInstance={this.forwardInstance}
                from={from}
                to={to}
                onFrame={this.onFrame}
                onRest={this.next}
            >
                {typeof children === 'function' ? children(currentStyle) : children}
            </Animation>
        );
    }
}
