import React from 'react';
import cls from 'classnames';
import '@douyinfe/semi-foundation/audioPlayer/audioPlayer.scss';
import { cssClasses } from '@douyinfe/semi-foundation/audioPlayer/constants';
import Tooltip from '../tooltip';
import { formatTime } from './utils';
import { noop } from 'lodash';
import { AudioPlayerTheme } from './index';

interface AudioSliderProps {
    value: number;
    onChange?: (value: number) => void;
    className?: string;
    max?: number;
    vertical?: boolean;
    width?: number;
    height?: number;
    showTooltip?: boolean;
    disabled?: boolean;
    theme?: AudioPlayerTheme
}

interface AudioSliderState {
    isDragging: boolean;
    movingInfo: { progress: number; offset: number } | null;
    isHovering: boolean
}
const prefixCls = cssClasses.PREFIX;
export default class AudioSlider extends React.Component<AudioSliderProps, AudioSliderState> {
    static defaultProps = {
        value: 0,
        onChange: noop,
        max: 100,
        vertical: false,
        width: '100%',
        height: 4,
        showTooltip: true,
        disabled: false,
        theme: 'dark'
    };

    private sliderRef: React.RefObject<HTMLDivElement>;
    private handleRef: React.RefObject<HTMLDivElement>;

    constructor(props: AudioSliderProps) {
        super(props);
        this.state = {
            isDragging: false,
            isHovering: false,
            movingInfo: null,
        };

        this.sliderRef = React.createRef();
        this.handleRef = React.createRef();
    }


    handleMouseEnter = (e: React.MouseEvent) => {
        this.setState({ isHovering: true });
        this.handleMouseEvent(e, false);
    }

    handleMouseDown = (e: React.MouseEvent) => {
        this.setState({ isDragging: true });
        this.handleMouseEvent(e, true);
    };

    handleMouseUp = () => {
        if (this.state.isDragging) {
            this.setState({ isDragging: false });
        }
    };

    handleMouseEvent = (e: React.MouseEvent, shouldSetValue: boolean = true) => {
        if (!this.sliderRef.current || this.props.disabled) return;
        const rect = this.sliderRef.current.getBoundingClientRect();
        const offset = this.props.vertical ?
            (rect.bottom - e.clientY) :
            (e.clientX - rect.left);
        const total = this.props.vertical ? rect.height : rect.width;
        const percentage = Math.min(Math.max(offset / total, 0), 1);
        const value = percentage * this.props.max;
        if (shouldSetValue && (this.state.isDragging || e.type === 'mousedown')) {
            this.props.onChange(value);
        }

        this.setState({
            movingInfo: {
                progress: percentage,
                offset: this.props.vertical ? offset - rect.height / 2 : offset - rect.width / 2
            },
        });
    };

    handleMouseMove = (e: React.MouseEvent) => {
        this.handleMouseEvent(e, true);
    }

    handleMouseLeave = () => {
        this.setState({ 
            isHovering: false,
            isDragging: false 
        });
    }

    render() {
        const { vertical, width, height, showTooltip, max, value: currentValue, theme } = this.props;
        const { movingInfo, isHovering } = this.state;
        const sliderContent = (
            <div
                onMouseDown={this.handleMouseDown}
                onMouseUp={this.handleMouseUp}
                onMouseEnter={this.handleMouseEnter}
                onMouseLeave={this.handleMouseLeave}
                onMouseMove={this.handleMouseMove}
                className={cls(`${prefixCls}-slider-wrapper`, {
                    [`${prefixCls}-slider-wrapper-vertical`]: vertical,
                    [`${prefixCls}-slider-wrapper-horizontal`]: !vertical,
                })}
            >
                <div
                    ref={this.sliderRef}
                    className={cls(`${prefixCls}-slider`, `${prefixCls}-slider-${theme}`, {
                        [`${prefixCls}-slider-vertical`]: vertical,
                        [`${prefixCls}-slider-horizontal`]: !vertical,
                    })}
                    style={{
                        width: vertical ? (isHovering ? 8 : 4) : width,
                        height: vertical ? height : (isHovering ? 8 : 4),
                    }}
                >
                    <div
                        className={cls(`${prefixCls}-slider-progress`, {
                            [`${prefixCls}-slider-progress-vertical`]: vertical,
                            [`${prefixCls}-slider-progress-horizontal`]: !vertical,
                        })}
                        style={{
                            height: vertical ? `${(currentValue / max) * 100}%` : '100%',
                            width: vertical ? '100%' : `${(currentValue / max) * 100}%`,
                        }}
                    />
                    <div
                        ref={this.handleRef}
                        className={cls(`${prefixCls}-slider-dot`)}
                        style={{
                            left: vertical ? '50%' : `calc(${(currentValue / max) * 100}% - 8px)`,
                            bottom: vertical ? `calc(${(currentValue / max) * 100}% - 8px)` : undefined,
                            top: vertical ? undefined : '50%',
                            transform: vertical ? 'translateX(-50%)' : 'translateY(-50%)',
                            opacity: isHovering ? 1 : 0,
                            transition: 'opacity 0.2s',
                            pointerEvents: 'none',
                        }}
                    />
                </div>
            </div>
        );

        return showTooltip ? (
            <Tooltip
                position={vertical ? 'right' : 'top'}
                autoAdjustOverflow
                content={formatTime(movingInfo?.progress * max)}
                style={{
                    [vertical ? 'top' : 'left']: movingInfo?.offset,
                }}
            >
                {sliderContent}
            </Tooltip>
        ) : sliderContent;
    }
}