import React, { CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/slider/constants';
import BaseComponent from '../_base/baseComponent';
import SliderFoundation, { SliderAdapter, SliderProps as BasicSliceProps, SliderState, tipFormatterBasicType } from '@douyinfe/semi-foundation/slider/foundation';
import Tooltip from '../tooltip/index';
import '@douyinfe/semi-foundation/slider/slider.scss';
import { isEqual, noop } from 'lodash';

const prefixCls = cssClasses.PREFIX;

export interface SliderProps extends BasicSliceProps {
    style?: CSSProperties;
    railStyle?: CSSProperties
}

export type {
    SliderState
};

function domIsInRenderTree(e: HTMLElement) {
    if (!e) {
        return false;
    }
    return Boolean(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
}

export default class Slider extends BaseComponent<SliderProps, SliderState> {
    static propTypes = {
        // allowClear: PropTypes.bool,
        defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
        disabled: PropTypes.bool,
        showMarkLabel: PropTypes.bool,
        included: PropTypes.bool, // Whether to juxtapose. Allow dragging
        marks: PropTypes.object, // Scale
        max: PropTypes.number,
        min: PropTypes.number,
        range: PropTypes.bool, // Whether both sides
        step: PropTypes.number,
        tipFormatter: PropTypes.func,
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
        vertical: PropTypes.bool,
        onAfterChange: PropTypes.func, // OnmouseUp and triggered when clicked
        onChange: PropTypes.func,
        onMouseUp: PropTypes.func,
        tooltipOnMark: PropTypes.bool,
        tooltipVisible: PropTypes.bool,
        showArrow: PropTypes.bool,
        style: PropTypes.object,
        className: PropTypes.string,
        showBoundary: PropTypes.bool,
        railStyle: PropTypes.object,
        verticalReverse: PropTypes.bool,
        getAriaValueText: PropTypes.func,
        handleDot: PropTypes.oneOfType([
            PropTypes.shape({
                size: PropTypes.string,
                color: PropTypes.string,
            }),
            PropTypes.arrayOf(
                PropTypes.shape({
                    size: PropTypes.string,
                    color: PropTypes.string,
                })
            ),
        ]),
    } as any;

    static defaultProps: Partial<SliderProps> = {
        // allowClear: false,
        disabled: false,
        showMarkLabel: true,
        tooltipOnMark: false,
        included: true, // No is juxtaposition. Allow dragging
        max: 100,
        min: 0,
        range: false, // Whether both sides
        showArrow: true,
        step: 1,
        tipFormatter: (value: tipFormatterBasicType | tipFormatterBasicType[]) => value,
        vertical: false,
        showBoundary: false,
        onAfterChange: (value: number | number[]) => {
            // console.log(value);
        },
        onChange: (value: number | number[]) => {
            // console.log(value);
        },
        verticalReverse: false
    };
    private sliderEl: React.RefObject<HTMLDivElement>;
    private minHanleEl: React.RefObject<HTMLSpanElement>;
    private maxHanleEl: React.RefObject<HTMLSpanElement>;
    private dragging: boolean[];
    private eventListenerSet: Set<() => void>;
    private handleDownEventListenerSet: Set<() => void>;
    foundation: SliderFoundation;

    constructor(props: SliderProps) {
        super(props);
        let { value } = this.props;
        if (!value) {
            value = this.props.defaultValue;
        }
        this.state = {
            currentValue: value ? value : this.props.range ? [0, 0] : 0,
            min: this.props.min || 0,
            max: this.props.max || 0,
            focusPos: '',
            onChange: this.props.onChange,
            disabled: this.props.disabled || false,
            chooseMovePos: '',
            isDrag: false,
            clickValue: 0,
            showBoundary: false,
            isInRenderTree: true,
            firstDotFocusVisible: false,
            secondDotFocusVisible: false,
        };
        this.sliderEl = React.createRef();
        this.minHanleEl = React.createRef();
        this.maxHanleEl = React.createRef();
        this.dragging = [false, false];
        this.foundation = new SliderFoundation(this.adapter);
        this.eventListenerSet = new Set();
        this.handleDownEventListenerSet = new Set();
    }

    get adapter(): SliderAdapter {
        return {
            ...super.adapter,
            getSliderLengths: () => {
                if (this.sliderEl && this.sliderEl.current) {
                    const rect = this.sliderEl.current.getBoundingClientRect();
                    const offsetParentRect = this.sliderEl.current.offsetParent?.getBoundingClientRect();

                    const offset = {
                        x: offsetParentRect ? (rect.left - offsetParentRect.left) : this.sliderEl.current.offsetLeft,
                        y: offsetParentRect ? (rect.top - offsetParentRect.top) : this.sliderEl.current.offsetTop,
                    };
                    return {
                        sliderX: offset.x,
                        sliderY: offset.y,
                        sliderWidth: rect.width,
                        sliderHeight: rect.height,
                    };
                }
                return {
                    sliderX: 0,
                    sliderY: 0,
                    sliderWidth: 0,
                    sliderHeight: 0,
                };
            },
            getParentRect: (): DOMRect | undefined => {
                const parentObj = this.sliderEl && this.sliderEl.current && this.sliderEl.current.offsetParent;
                if (!parentObj) {
                    return undefined;
                }
                return parentObj.getBoundingClientRect();
            },
            getScrollParentVal: () => {
                const scrollParent = this.foundation.getScrollParent(this.sliderEl.current);
                return {
                    scrollTop: scrollParent.scrollTop,
                    scrollLeft: scrollParent.scrollLeft,
                };
            },
            isEventFromHandle: (e: React.MouseEvent) => {
                const handles = [this.minHanleEl, this.maxHanleEl];
                let flag = false;
                handles.forEach(handle => {
                    if (!handle) {
                        return;
                    }
                    const handleDom = handle && handle.current;
                    if (handleDom && handleDom.contains(e.target as Node)) {
                        flag = true;
                    }
                });
                return flag;
            },
            getOverallVars: () => ({
                dragging: this.dragging,
            }),
            updateDisabled: (disabled: boolean) => {
                this.setState({ disabled });
            },
            transNewPropsToState<K extends keyof SliderState>(stateObj: Pick<SliderState, K>, callback = noop) {
                this.setState(stateObj, callback);
            },
            notifyChange: (cbValue: number | number[]) => {
                this.props.onChange(Array.isArray(cbValue) ? [...cbValue].sort((a, b)=>a - b) : cbValue);
            },
            setDragging: (value: boolean[]) => {
                this.dragging = value;
            },
            updateCurrentValue: (value: number | number[]) => {
                const { currentValue } = this.state;
                if (value !== currentValue) {
                    this.setState({ currentValue: value });
                }
            },
            setOverallVars: (key: string, value: any) => {
                this[key] = value;
            },
            getMinHandleEl: () => this.minHanleEl.current,
            getMaxHandleEl: () => this.maxHanleEl.current,
            onHandleDown: (e: React.MouseEvent) => {
                this.handleDownEventListenerSet.add(this._addEventListener(document.body, 'mousemove', this.foundation.onHandleMove, false));
                this.handleDownEventListenerSet.add(this._addEventListener(window, 'mouseup', this.foundation.onHandleUp, false));
                this.handleDownEventListenerSet.add(this._addEventListener(document.body, 'touchmove', this.foundation.onHandleTouchMove, false));
            },
            onHandleMove: (mousePos: number, isMin: boolean, stateChangeCallback = noop, clickTrack = false, outPutValue): boolean | void => {

                const sliderDOMIsInRenderTree = this.foundation.checkAndUpdateIsInRenderTreeState();
                if (!sliderDOMIsInRenderTree) {
                    return;
                }

                const { value } = this.props;


                let finalOutPutValue = outPutValue;
                if (finalOutPutValue === undefined) {
                    const moveValue = this.foundation.transPosToValue(mousePos, isMin);
                    if (moveValue === false) {
                        return;
                    }
                    finalOutPutValue = this.foundation.outPutValue(moveValue);
                }

                const { currentValue } = this.state;
                if (!isEqual(this.foundation.outPutValue(currentValue), finalOutPutValue)) {
                    if (!clickTrack && this.foundation.valueFormatIsCorrect(value)) {
                        // still require afterChangeCallback when click on the track directly, need skip here
                        return false;
                    }
                    this.setState({
                        currentValue: finalOutPutValue,
                    }, stateChangeCallback);
                }
            },
            setEventDefault: (e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
            },
            setStateVal: <K extends keyof SliderState>(name: K, val: SliderState[K]) => {
                this.setState({ [name]: val } as Pick<SliderState, K>);
            },
            checkAndUpdateIsInRenderTreeState: () => {
                const sliderDOMIsInRenderTree = domIsInRenderTree(this.sliderEl.current);
                if (sliderDOMIsInRenderTree !== this.state.isInRenderTree) {
                    this.setState({ isInRenderTree: sliderDOMIsInRenderTree });
                }
                return sliderDOMIsInRenderTree;
            },
            onHandleEnter: (pos: SliderState['focusPos']) => {
                this.setState({ focusPos: pos });
            },
            onHandleLeave: () => {
                this.setState({ focusPos: '' });
            },
            onHandleUpBefore: (e: React.MouseEvent) => {
                this.props.onMouseUp?.(e);
                e.stopPropagation();
                e.preventDefault();
                Array.from(this.handleDownEventListenerSet).forEach((clear) => clear());
                this.handleDownEventListenerSet.clear();
            },
            onHandleUpAfter: () => {
                const { currentValue } = this.state;
                const value = this.foundation.outPutValue(currentValue);
                this.props.onAfterChange(value);
            },
            unSubscribeEventListener: () => {
                Array.from(this.eventListenerSet).forEach(clear => clear());
            },
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentDidUpdate(prevProps: SliderProps, prevState: SliderState) {
        const hasPropValueChange = !isEqual(this.props.value, prevProps.value);
        const hasPropDisabledChange = this.props.disabled !== prevProps.disabled;

        if (hasPropDisabledChange) {
            this.foundation.handleDisabledChange(this.props.disabled);
        }

        if (hasPropValueChange) {
            const nextValue = this.props.value;
            const prevValue = this.state.currentValue;
            this.foundation.handleValueChange(prevValue, nextValue);
            // trigger onAfterChange when value is controlled and changed
            this.props.onAfterChange(this.props.value);
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    renderHandle = () => {
        const { vertical, range, tooltipVisible, tipFormatter, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, 'aria-valuetext': ariaValueText, getAriaValueText, disabled } = this.props;
        const { chooseMovePos, isDrag, isInRenderTree, firstDotFocusVisible, secondDotFocusVisible } = this.state;
        const stylePos = vertical ? 'top' : 'left';
        const percentInfo = this.foundation.getMinAndMaxPercent(this.state.currentValue);
        const minPercent = percentInfo.min;
        const maxPercent = percentInfo.max;
        const { tipVisible, tipChildren } = this.foundation.computeHandleVisibleVal(
            tooltipVisible && isInRenderTree,
            tipFormatter,
            range
        );
        const minClass = cls(cssClasses.HANDLE, {
            [`${cssClasses.HANDLE}-clicked`]: chooseMovePos === 'min' && isDrag,
        });
        const maxClass = cls(cssClasses.HANDLE, {
            [`${cssClasses.HANDLE}-clicked`]: chooseMovePos === 'max' && isDrag,
        });
        const { min, max, currentValue } = this.state;

        const commonAria = {
            'aria-label': ariaLabel ?? (disabled ? 'Disabled Slider' : undefined),
            'aria-labelledby': ariaLabelledby,
            'aria-disabled': disabled
        };
        vertical && Object.assign(commonAria, { 'aria-orientation': 'vertical' });
        const handleDot = this.props.handleDot as {
            size?: string;
            color?: string
        } & ({
            size?: string;
            color?: string
        }[]);
        const handleContents = !range ? (
            <Tooltip
                content={tipChildren.min}
                showArrow={this.props.showArrow}
                position="top"
                trigger="custom"
                rePosKey={minPercent}
                visible={isInRenderTree && (tipVisible.min || firstDotFocusVisible)}
                className={`${cssClasses.HANDLE}-tooltip`}
            >
                <span
                    onMouseOver={this.foundation.checkAndUpdateIsInRenderTreeState}
                    ref={this.minHanleEl}
                    className={minClass}
                    style={{
                        [stylePos]: `${minPercent * 100}%`,
                        zIndex: chooseMovePos === 'min' && isDrag ? 2 : 1,
                    }}
                    onMouseDown={e => {
                        this.foundation.onHandleDown(e, 'min');
                    }}
                    onMouseEnter={() => {
                        this.foundation.onHandleEnter('min');
                    }}
                    onTouchStart={e => {
                        this.foundation.onHandleTouchStart(e, 'min');
                    }}
                    onMouseLeave={() => {
                        this.foundation.onHandleLeave();
                    }}
                    onKeyUp={e => {
                        this.foundation.onHandleUp(e);
                    }}
                    onTouchEnd={e => {
                        this.foundation.onHandleUp(e);
                    }}
                    onKeyDown={(e) => {
                        this.foundation.handleKeyDown(e, 'min');
                    }}
                    onFocus={e => {
                        this.foundation.onFocus(e, 'min');
                    }}
                    onBlur={(e) => {
                        this.foundation.onBlur(e, 'min');
                    }}
                    role="slider"
                    aria-valuetext={getAriaValueText ? getAriaValueText(currentValue as number, 0) : ariaValueText}
                    tabIndex={disabled ? -1 : 0}
                    {...commonAria}
                    aria-valuenow={currentValue as number}
                    aria-valuemax={max}
                    aria-valuemin={min}
                >
                    {handleDot && <div className={cssClasses.HANDLE_DOT} style={{
                        ...(handleDot?.size ? { width: handleDot.size, height: handleDot.size } : {}),
                        ...(handleDot?.color ? { backgroundColor: handleDot.color } : {}),
                    }} />}
                </span>
            </Tooltip>
        ) : (
            <React.Fragment>
                <Tooltip
                    content={tipChildren.min}
                    position="top"
                    trigger="custom"
                    rePosKey={minPercent}
                    visible={isInRenderTree && (tipVisible.min || firstDotFocusVisible)}
                    className={`${cssClasses.HANDLE}-tooltip`}
                >
                    <span
                        ref={this.minHanleEl}
                        className={minClass}
                        style={{
                            [stylePos]: `${minPercent * 100}%`,
                            zIndex: chooseMovePos === 'min' ? 2 : 1,
                        }}
                        onMouseDown={e => {
                            this.foundation.onHandleDown(e, 'min');
                        }}
                        onMouseEnter={() => {
                            this.foundation.onHandleEnter('min');
                        }}
                        onTouchStart={e => {
                            this.foundation.onHandleTouchStart(e, 'min');
                        }}
                        onMouseLeave={() => {
                            this.foundation.onHandleLeave();
                        }}
                        onKeyUp={e => {
                            this.foundation.onHandleUp(e);
                        }}
                        onTouchEnd={e => {
                            this.foundation.onHandleUp(e);
                        }}
                        onKeyDown={(e) => {
                            this.foundation.handleKeyDown(e, 'min');
                        }}
                        onFocus={e => {
                            this.foundation.onFocus(e, 'min');
                        }}
                        onBlur={(e) => {
                            this.foundation.onBlur(e, 'min');
                        }}
                        role="slider"
                        tabIndex={disabled ? -1 : 0}
                        {...commonAria}
                        aria-valuetext={getAriaValueText ? getAriaValueText(currentValue[0], 0) : ariaValueText}
                        aria-valuenow={currentValue[0]}
                        aria-valuemax={currentValue[1]}
                        aria-valuemin={min}
                    >
                        {handleDot?.[0] && <div className={cssClasses.HANDLE_DOT} style={{
                            ...(handleDot[0]?.size ? { width: handleDot[0].size, height: handleDot[0].size } : {}),
                            ...(handleDot[0]?.color ? { backgroundColor: handleDot[0].color } : {}),
                        }} />}
                    </span>
                </Tooltip>
                <Tooltip
                    content={tipChildren.max}
                    position="top"
                    trigger="custom"
                    rePosKey={maxPercent}
                    visible={isInRenderTree && (tipVisible.max || secondDotFocusVisible)}
                    className={`${cssClasses.HANDLE}-tooltip`}
                >
                    <span
                        ref={this.maxHanleEl}
                        className={maxClass}
                        style={{
                            [stylePos]: `${maxPercent * 100}%`,
                            zIndex: chooseMovePos === 'max' ? 2 : 1,
                        }}
                        onMouseDown={e => {
                            this.foundation.onHandleDown(e, 'max');
                        }}
                        onMouseEnter={() => {
                            this.foundation.onHandleEnter('max');
                        }}
                        onMouseLeave={() => {
                            this.foundation.onHandleLeave();
                        }}
                        onKeyUp={e => {
                            this.foundation.onHandleUp(e);
                        }}
                        onTouchStart={e => {
                            this.foundation.onHandleTouchStart(e, 'max');
                        }}
                        onTouchEnd={e => {
                            this.foundation.onHandleUp(e);
                        }}
                        onKeyDown={e => {
                            this.foundation.handleKeyDown(e, 'max');
                        }}
                        onFocus={e => {
                            this.foundation.onFocus(e, 'max');
                        }}
                        onBlur={(e) => {
                            this.foundation.onBlur(e, 'max');
                        }}
                        role="slider"
                        tabIndex={disabled ? -1 : 0}
                        {...commonAria}
                        aria-valuetext={getAriaValueText ? getAriaValueText(currentValue[1], 1) : ariaValueText}
                        aria-valuenow={currentValue[1]}
                        aria-valuemax={max}
                        aria-valuemin={currentValue[0]}
                    >
                        {this.props.handleDot?.[1] && <div className={cssClasses.HANDLE_DOT} style={{
                            ...(this.props.handleDot[1]?.size ? { width: this.props.handleDot[1].size, height: this.props.handleDot[1].size } : {}),
                            ...(this.props.handleDot[1]?.color ? { backgroundColor: this.props.handleDot[1].color } : {}),
                        }} />}
                    </span>
                </Tooltip>
            </React.Fragment>
        );
        return handleContents;
    };

    renderTrack = () => {
        const { range, included, vertical } = this.props;
        const percentInfo = this.foundation.getMinAndMaxPercent(this.state.currentValue);
        const minPercent = percentInfo.min;
        const maxPercent = percentInfo.max;
        let trackStyle: CSSProperties = !vertical ?
            {
                width: range ? `${Math.abs(maxPercent - minPercent) * 100}%` : `${minPercent * 100}%`,
                left: range ? `${Math.min(minPercent, maxPercent) * 100}%` : 0,
            } :
            {
                height: range ? `${Math.abs(maxPercent - minPercent) * 100}%` : `${minPercent * 100}%`,
                top: range ? `${Math.min(minPercent, maxPercent) * 100}%` : 0,
            };
        trackStyle = included ? trackStyle : {};
        return (// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div className={cssClasses.TRACK} style={trackStyle} onClick={this.foundation.handleWrapClick}>
                {/* {this.renderTrack} */}
            </div>
        );
    };

    renderStepDot = () => {
        const { min, max, vertical, marks } = this.props;
        const stylePos = vertical ? 'top' : 'left';
        const labelContent =
            marks && Object.keys(marks).length > 0 ? (
                <div className={cssClasses.DOTS}>
                    {Object.keys(marks).map(mark => {
                        const activeResult = this.foundation.isMarkActive(Number(mark));
                        const markClass = cls(`${prefixCls}-dot`, {
                            [`${prefixCls}-dot-active`]: this.foundation.isMarkActive(Number(mark)) === 'active',
                        });
                        const markPercent = (Number(mark) - min) / (max - min);
                        const dotDOM = // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                            <span
                                key={mark}
                                onClick={this.foundation.handleWrapClick}
                                className={markClass}
                                style={{ [stylePos]: `calc(${markPercent * 100}% - 2px)` }}
                            />;
                        return activeResult ? (
                            this.props.tooltipOnMark ? <Tooltip content={marks[mark]}>{dotDOM}</Tooltip> : dotDOM
                        ) : null;
                    })}
                </div>
            ) : null;
        return labelContent;
    };

    renderLabel = () => {
        if (!this.props.showMarkLabel) {
            return null;
        }
        const { min, max, vertical, marks, verticalReverse } = this.props;
        const stylePos = vertical ? 'top' : 'left';
        const labelContent =
            marks && Object.keys(marks).length > 0 ? (
                <div className={cssClasses.MARKS + ((vertical && verticalReverse) ? '-reverse' : '')}>
                    {Object.keys(marks).map(mark => {
                        const activeResult = this.foundation.isMarkActive(Number(mark));
                        const markPercent = (Number(mark) - min) / (max - min);
                        return activeResult ? (
                            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                            <span
                                key={mark}
                                className={cls(`${prefixCls}-mark${(vertical && verticalReverse) ? '-reverse' : ''}`)}
                                style={{ [stylePos]: `${markPercent * 100}%` }}
                                onClick={this.foundation.handleWrapClick}
                            >
                                {marks[mark]}
                            </span>
                        ) : null;
                    })}
                </div>
            ) : null;
        return labelContent;
    };

    _getAriaValueText = (value: number, index?: number) => {
        const { getAriaValueText } = this.props;
        return getAriaValueText ? getAriaValueText(value, index) : value;
    }


    render() {
        const { disabled, currentValue, min, max } = this.state;
        const { vertical, verticalReverse, style, railStyle, range, className, ...rest } = this.props;
        const wrapperClass = cls(
            `${prefixCls}-wrapper`,
            {
                [`${prefixCls}-disabled`]: disabled,
                [`${cssClasses.VERTICAL}-wrapper`]: vertical,
                [`${prefixCls}-reverse`]: vertical && verticalReverse
            },
            className
        );
        const boundaryClass = cls(`${prefixCls}-boundary`, {
            [`${prefixCls}-boundary-show`]: this.props.showBoundary && this.state.showBoundary,
        });
        const sliderCls = cls({
            [`${prefixCls}`]: !vertical,
            [cssClasses.VERTICAL]: vertical,
        });
        const fixedCurrentValue = Array.isArray(currentValue) ? [...currentValue].sort() : currentValue;
        const ariaLabel = range ? `Range: ${this._getAriaValueText(fixedCurrentValue[0], 0)} to ${this._getAriaValueText(fixedCurrentValue[1], 1)}` : undefined;
        const slider = (
            <div
                className={wrapperClass}
                style={style}
                ref={this.sliderEl}
                aria-label={ariaLabel}
                onMouseEnter={() => this.foundation.handleWrapperEnter()}
                onMouseLeave={() => this.foundation.handleWrapperLeave()}
                {...this.getDataAttr(rest)}
            >
                {// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                    <div
                        className={`${prefixCls}-rail`}
                        onClick={this.foundation.handleWrapClick}
                        style={railStyle}
                    />
                }
                {this.renderTrack()}
                {this.renderStepDot()}
                <div>{this.renderHandle()}</div>
                {this.renderLabel()}
                <div className={boundaryClass}>
                    <span className={`${prefixCls}-boundary-min`}>{min}</span>
                    <span className={`${prefixCls}-boundary-max`}>{max}</span>
                </div>
            </div>
        );
        if (!vertical) {
            return <div className={sliderCls}>{slider}</div>;
        }
        return slider;
    }

    private _addEventListener<T extends keyof (HTMLElementEventMap & WindowEventMap)>(target: HTMLElement | Window, eventName: T, callback: EventListenerOrEventListenerObject, ...rests: any) {
        if (target.addEventListener) {
            target.addEventListener(eventName, callback, ...rests);
            const clearSelf = () => {
                target?.removeEventListener(eventName, callback);
                Promise.resolve().then(() => {
                    this.eventListenerSet.delete(clearSelf);
                });
            };
            this.eventListenerSet.add(clearSelf);
            return clearSelf;
        } else {
            return noop;
        }
    }
}
