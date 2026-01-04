import React, { PureComponent, isValidElement, cloneElement, Children } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { types as styledTypes, loops, delays, speeds } from '@douyinfe/semi-animation-styled';
import noop from './utils/noop';
import invokeFns from './utils/invokeFns';

export interface StyledAnimationProps {
    className?: string;
    type?: any;
    style?: React.CSSProperties;
    speed?: string | number;
    delay?: string | number;
    reverse?: boolean | string;
    loop?: string | number;
    children?: any;
    onStart?: (value: any) => void;
    onFrame?: (value: any) => void;
    onRest?: (value: any) => void;
    prefixCls?: string;
    timing?: string;
    duration?: string | number;
    fillMode?: string
}

export interface StyledAnimateStyleType {
    animationTimingFunction: string;
    animationName: any;
    animationDuration: string | number;
    animationDelay: string | number;
    animationIterationCount: string | number;
    animationDirection: string;
    animationFillMode: string
}

const types: any = Object.values(styledTypes).reduce((arr, cur) => [...arr as any, ...cur as any], []);

export default class StyledAnimation extends PureComponent<StyledAnimationProps> {
    static propTypes = {
        className: PropTypes.string,
        type: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
        speed: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        delay: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        reverse: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        loop: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        children: PropTypes.any,
        onStart: PropTypes.func,
        onFrame: PropTypes.func,
        onRest: PropTypes.func,
        prefixCls: PropTypes.string,
        timing: PropTypes.string,
        duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        fillMode: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: 'semi',
        speed: 'faster',
        onFrame: noop,
        onStart: noop,
        onRest: noop,
    };

    constructor(props = {}) {
        super(props);
    }

    _generateAnimateEvents = (child: React.ReactElement, props: StyledAnimationProps = {}) => ({
        onAnimationIteration: (...args: any) =>
            invokeFns([child && child.props && child.props.onAnimationIteration, props.onFrame], args),
        onAnimationStart: (...args: any) =>
            invokeFns([child && child.props && child.props.onAnimationStart, props.onStart], args),
        onAnimationEnd: (...args: any) =>
            invokeFns([child && child.props && child.props.onAnimationEnd, props.onRest], args),
    });

    _hasSpeedClass = (speed = this.props.speed) => speed != null && speeds.includes(speed as string);
    _hasTypeClass = (type = this.props.type) => type != null && types.includes(type);
    _hasDelayClass = (delay = this.props.delay) => delay != null && delays.includes(delay as string);
    _hasLoopClass = (loop = this.props.loop) => loop != null && loops.includes(loop as string);

    render() {
        let {
            type,
            speed,
            duration,
            delay,
            loop,
            reverse,
            children,
            prefixCls,
            timing,
            className,
            fillMode,
        } = this.props;

        const hasTypeClass = this._hasTypeClass();
        const hasSpeedClass = this._hasSpeedClass();
        const hasDelayClass = this._hasDelayClass();
        const hasLoopClass = this._hasLoopClass();

        const animateCls =
            className ||
            classnames(`${prefixCls}-animated`, {
                [`${prefixCls}-${type}`]: Boolean(type), // How to use it before compatibility
                [`${prefixCls}-speed-${speed}`]: hasSpeedClass,
                [`${prefixCls}-delay-${delay}`]: hasDelayClass,
                [`${prefixCls}-loop-${loop}`]: hasLoopClass,
            });

        const animateStyle = {
            animationTimingFunction: timing,
            animationName: !hasTypeClass && type,
            animationDuration: duration,
            animationDelay: !hasDelayClass && delay,
            animationIterationCount: !hasLoopClass && loop,
            animationDirection: reverse ? 'alternate' : 'normal',
            animationFillMode: fillMode,
        };

        if (isValidElement(children)) {
            children = Children.map(children, (child: React.ReactElement) => {
                const animateEvents = this._generateAnimateEvents(child, this.props);
                return cloneElement(child, {
                    className: classnames(child.props.className, animateCls),
                    style: { ...child.props.style, ...this.props.style },
                    ...animateEvents,
                });
            });
        }

        return typeof children === 'function' ?
            children({ animateCls, animateStyle, animateEvents: this._generateAnimateEvents(null, this.props) }) :
            children;
    }
}
