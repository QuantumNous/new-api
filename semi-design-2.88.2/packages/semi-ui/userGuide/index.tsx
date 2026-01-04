import React, { ReactNode } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, numbers, strings } from '@douyinfe/semi-foundation/userGuide/constants';
import UserGuideFoundation, { UserGuideAdapter } from '@douyinfe/semi-foundation/userGuide/foundation';
import { Position } from '../tooltip/index';
import BaseComponent from '../_base/baseComponent';
import Popover from '../popover';
import Button, { ButtonProps } from '../button';
import Modal from '../modal';
import { noop } from '@douyinfe/semi-foundation/utils/function';
import '@douyinfe/semi-foundation/userGuide/userGuide.scss';
import { BaseProps } from '../_base/baseComponent';
import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';
import { Locale } from '../locale/interface';
import LocaleConsumer from '../locale/localeConsumer';
import { getScrollbarWidth } from '../_utils';


const prefixCls = cssClasses.PREFIX;

export interface UserGuideProps extends BaseProps {
    className?: string;
    current?: number;
    finishText?: string;
    mask?: boolean;
    mode?: 'popup' | 'modal';
    nextButtonProps?: ButtonProps;
    onChange?: (current: number) => void;
    onFinish?: () => void;
    onNext?: (current: number) => void;
    onPrev?: (current: number) => void;
    onSkip?: () => void;
    position?: Position;
    prevButtonProps?: ButtonProps;
    showPrevButton?: boolean;
    showSkipButton?: boolean;
    spotlightPadding?: number;
    steps: StepItem[];
    style?: React.CSSProperties;
    theme?: 'default' | 'primary';
    visible?: boolean;
    getPopupContainer?: () => HTMLElement;
    zIndex?: number
}

export interface StepItem {
    className?: string;
    cover?: ReactNode;
    target?: (() => Element) | Element;
    title?: string | ReactNode;
    description?: React.ReactNode;
    mask?: boolean;
    showArrow?: boolean;
    spotlightPadding?: number;
    theme?: 'default' | 'primary';
    position?: Position
}

export interface UserGuideState {
    current: number;
    spotlightRect: DOMRect | null
}

class UserGuide extends BaseComponent<UserGuideProps, UserGuideState> {
    static propTypes = {
        mask: PropTypes.bool,
        mode: PropTypes.oneOf(strings.MODE),
        onChange: PropTypes.func,
        onFinish: PropTypes.func,
        onNext: PropTypes.func,
        onPrev: PropTypes.func,
        onSkip: PropTypes.func,
        position: PropTypes.oneOf(strings.POSITION_SET),
        showPrevButton: PropTypes.bool,
        showSkipButton: PropTypes.bool,
        theme: PropTypes.oneOf(strings.THEME),
        visible: PropTypes.bool,
        getPopupContainer: PropTypes.func,
        zIndex: PropTypes.number,
    };

    static defaultProps: UserGuideProps = {
        mask: true,
        mode: 'popup',
        nextButtonProps: {},
        onChange: noop,
        onFinish: noop,
        onNext: noop,
        onPrev: noop,
        onSkip: noop,
        position: 'bottom',
        prevButtonProps: {},
        showPrevButton: true,
        showSkipButton: true,
        steps: [],
        theme: 'default',
        visible: false,
        zIndex: numbers.DEFAULT_Z_INDEX,
    };

    private bodyOverflow: string;
    private scrollBarWidth: number;
    private originBodyWidth: string;
    foundation: UserGuideFoundation;
    userGuideId: string;

    constructor(props: UserGuideProps) {
        super(props);
        this.foundation = new UserGuideFoundation(this.adapter);
        this.state = {
            current: props.current || numbers.DEFAULT_CURRENT,
            spotlightRect: null,
        };
        this.scrollBarWidth = 0;
        this.userGuideId = '';
    }

    get adapter(): UserGuideAdapter<UserGuideProps, UserGuideState> {
        return {
            ...super.adapter,
            disabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                this.bodyOverflow = document.body.style.overflow || '';
                if (!getPopupContainer && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = 'hidden';
                    document.body.style.width = `calc(${this.originBodyWidth || '100%'} - ${this.scrollBarWidth}px)`;
                }
            },
            enabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                if (!getPopupContainer && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = this.bodyOverflow;
                    document.body.style.width = this.originBodyWidth;
                }
            },
            notifyChange: (current: number) => {
                this.props.onChange(current);
            },
            notifyFinish: () => {
                this.props.onFinish();
            },
            notifyNext: (current: number) => {
                this.props.onNext(current);
            },
            notifyPrev: (current: number) => {
                this.props.onPrev(current);
            },
            notifySkip: () => {
                this.props.onSkip();
            },
            setCurrent: (current: number) => {
                this.setState({ current });
            }
        };
    }

    static getDerivedStateFromProps(props: UserGuideProps, state: UserGuideState): Partial<UserGuideState> {
        const states: Partial<UserGuideState> = {};
        if (!isNullOrUndefined(props.current) && props.current !== state.current) {
            states.current = props.current;
        }
        return states;
    }

    componentDidMount() {
        this.foundation.init();
        this.scrollBarWidth = getScrollbarWidth();
        this.userGuideId = getUuidShort();
    }

    componentDidUpdate(prevProps: UserGuideProps, prevStates: UserGuideState) {
        const { steps, mode, visible } = this.props;
        const { current } = this.state;

        if (visible !== prevProps.visible) {
            if (visible) {
                this.foundation.beforeShow();
                this.setState({ current: 0 });
            } else {
                this.foundation.afterHide();
            }
        }

        if (mode === 'popup' && (prevStates.current !== current) && steps[current] || (prevProps.visible !== visible)) {
            this.updateSpotlightRect();
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    scrollTargetIntoViewIfNeeded(target: Element) {
        if (!target) {
            return ;
        }
        
        const rect = target.getBoundingClientRect();
        const isInViewport = 
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);
        
        if (!isInViewport) {
            target.scrollIntoView({
                behavior: 'auto',
                block: 'center'
            });

        }
    }


    async updateSpotlightRect() {
        const { steps, spotlightPadding } = this.props;
        const { current } = this.state;
        const step = steps[current];

        if (step.target) {
            const target = typeof step.target === 'function' ? step.target() : step.target;
            // Checks if the target element is within the viewport, and scrolls it into view if not
            this.scrollTargetIntoViewIfNeeded(target);

            const rect = target?.getBoundingClientRect();
            const padding = step?.spotlightPadding || spotlightPadding || numbers.DEFAULT_SPOTLIGHT_PADDING;

            const newRects = new DOMRect(
                rect.x - padding,
                rect.y - padding,
                rect.width + padding * 2,
                rect.height + padding * 2
            );

            requestAnimationFrame(() => {
                this.setState({ spotlightRect: newRects });
            });
        }
    }

    renderPopupContent(step: StepItem, index: number) {
        const { showPrevButton, showSkipButton, theme, steps, finishText, nextButtonProps, prevButtonProps } = this.props;
        const { current } = this.state;

        const isFirst = index === 0;
        const isLast = index === steps.length - 1;
        const popupPrefixCls = `${prefixCls}-popup-content`;
        const isPrimaryTheme = theme === 'primary' || step?.theme === 'primary';
        const { cover, title, description } = step;

        return (
            <LocaleConsumer componentName="UserGuide">
                {(locale: Locale['UserGuide'], localeCode: Locale['code']) => (
                    <div className={cls(`${popupPrefixCls}`, {
                        [`${popupPrefixCls}-primary`]: isPrimaryTheme,
                    })}
                    >
                        {cover && <div className={`${popupPrefixCls}-cover`}>{cover}</div>}
                        <div className={`${popupPrefixCls}-body`}>
                            {title && <div className={`${popupPrefixCls}-title`}>{title}</div>}
                            {description && <div className={`${popupPrefixCls}-description`}>{description}</div>}
                            <div className={`${popupPrefixCls}-footer`}>
                                {steps.length > 1 && (
                                    <div className={`${popupPrefixCls}-indicator`}>
                                        {current + 1}/{steps.length}
                                    </div>
                                )}
                                <div className={`${popupPrefixCls}-buttons`}>
                                    {showSkipButton && !isLast && (
                                        <Button 
                                            style={isPrimaryTheme ? { backgroundColor: 'var(--semi-color-fill-2)' } : {}}
                                            theme={isPrimaryTheme ? 'solid' : 'light'} 
                                            type={isPrimaryTheme ? 'primary' : 'tertiary'} 
                                            onClick={this.foundation.handleSkip}
                                        >
                                            {locale.skip}
                                        </Button>
                                    )}
                                    {showPrevButton && !isFirst && (
                                        <Button 
                                            style={isPrimaryTheme ? { backgroundColor: 'var(--semi-color-fill-2)' } : {}}
                                            theme={isPrimaryTheme ? 'solid' : 'light'} 
                                            type={isPrimaryTheme ? 'primary' : 'tertiary'} 
                                            onClick={this.foundation.handlePrev}
                                            {...prevButtonProps}
                                        >
                                            {prevButtonProps?.children || locale.prev}
                                        </Button>
                                    )}
                                    <Button 
                                        style={isPrimaryTheme ? { backgroundColor: '#FFF' } : {}}
                                        theme={isPrimaryTheme ? 'borderless' : 'solid'} 
                                        type={'primary'} 
                                        onClick={this.foundation.handleNext}
                                        {...nextButtonProps}
                                    >
                                        {isLast ? (finishText || locale.finish) : (nextButtonProps?.children || locale.next)}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </LocaleConsumer>
        );
    }

    renderStep = (step: StepItem, index: number) => {
        const { theme, position, visible, className, style, spotlightPadding } = this.props;
        const { current } = this.state;

        const isCurrentStep = current === index;
        if (!step.target) {
            return null;
        }

        const basePopoverStyle = { padding: 0 };

        const target = typeof step.target === 'function' ? step.target() : step.target;
        const rect = target.getBoundingClientRect();
        const padding = step?.spotlightPadding || spotlightPadding || numbers.DEFAULT_SPOTLIGHT_PADDING;
        const isPrimaryTheme = theme === 'primary' || step?.theme === 'primary';
        const primaryStyle = isPrimaryTheme ? { backgroundColor: 'var(--semi-color-primary)' } : {};


        return (
            <Popover
                key={`userGuide-popup-${index}`}
                className={cls(`${prefixCls}-popover`, className)}
                style={{ ...basePopoverStyle, ...primaryStyle, ...style }}
                content={this.renderPopupContent(step, index)}
                position={step.position || position}
                trigger="custom"
                visible={visible && isCurrentStep}
                showArrow={step.showArrow !== false}
            >
                <div
                    style={{
                        position: 'fixed',
                        left: rect.x - padding,
                        top: rect.y - padding,
                        width: rect.width + padding * 2,
                        height: rect.height + padding * 2,
                        pointerEvents: 'none',
                    }}
                >
                </div>
            </Popover>
        );
    };

    renderSpotlight() {
        const { steps, mask, zIndex } = this.props;
        const { spotlightRect, current } = this.state;
        const step = steps[current];

        if (!step.target) {
            return null;
        }

        if (!spotlightRect) {
            this.updateSpotlightRect();
        }

        return (
            <>
                {
                    spotlightRect ? (
                        <svg className={`${prefixCls}-spotlight`} style={{ zIndex }}>
                            <defs>
                                <mask id={`spotlight-${this.userGuideId}`}>
                                    <rect width="100%" height="100%" fill="white"/>
                                    <rect
                                        className={`${prefixCls}-spotlight-rect`}
                                        x={spotlightRect.x}
                                        y={spotlightRect.y}
                                        width={spotlightRect.width}
                                        height={spotlightRect.height}
                                        rx={4}
                                        fill="black"
                                    />
                                </mask>
                            </defs>
                            {
                                mask && (
                                    <>
                                        <rect
                                            width="100%"
                                            height="100%"
                                            fill="var(--semi-color-overlay-bg)"
                                            mask={`url(#spotlight-${this.userGuideId})`} />
                                        <rect
                                            x={0}
                                            y={0}
                                            width="100%"
                                            height={spotlightRect.y}
                                            fill="transparent"
                                            className={`${prefixCls}-spotlight-transparent-rect`} />
                                        <rect
                                            x={0}
                                            y={spotlightRect.y}
                                            width={spotlightRect.x}
                                            height={spotlightRect.height}
                                            fill="transparent"
                                            className={`${prefixCls}-spotlight-transparent-rect`} />
                                        <rect
                                            x={spotlightRect.x + spotlightRect.width}
                                            y={spotlightRect.y}
                                            width={`calc(100% - ${spotlightRect.x + spotlightRect.width}px)`}
                                            height={spotlightRect.height}
                                            fill="transparent"
                                            className={`${prefixCls}-spotlight-transparent-rect`} />
                                        <rect
                                            y={spotlightRect.y + spotlightRect.height}
                                            width="100%"
                                            height={`calc(100% - ${spotlightRect.y + spotlightRect.height}px)`}
                                            fill="transparent"
                                            className={`${prefixCls}-spotlight-transparent-rect`} />
                                    </>
                                )
                            }
                        </svg>
                    ) : null
                }
            </>
        );
    }

    renderIndicator = () => {
        const { steps } = this.props;
        const { current } = this.state;
        const indicatorContent: ReactNode[] = [];
        for (let i = 0; i < steps.length; i++) {
            indicatorContent.push(
                <span
                    key={i}
                    data-index={i}
                    className={cls([`${cssClasses.PREFIX_MODAL}-indicator-item`], {
                        [`${cssClasses.PREFIX_MODAL}-indicator-item-active`]: i === current
                    })}
                ></span>
            );
        }
        return indicatorContent;
    }

    renderModal = () => {
        const { visible, steps, showSkipButton, showPrevButton, finishText, nextButtonProps, prevButtonProps, mask } = this.props;
        const { current } = this.state;
        const step = steps[current];

        const isFirst = current === 0;
        const isLast = current === steps.length - 1;
        const { cover, title, description } = step;

        return (
            <LocaleConsumer componentName="UserGuide">
                {(locale: Locale['UserGuide'], localeCode: Locale['code']) => (
                    <Modal
                        className={cssClasses.PREFIX_MODAL}
                        bodyStyle={{ padding: 0 }}
                        header={null}
                        visible={visible}
                        maskClosable={false}
                        mask={mask}
                        centered
                        footer={null}
                    >
                        {cover && 
                        <>
                            <div className={`${cssClasses.PREFIX_MODAL}-cover`}>
                                {cover}
                            </div>
                            <div className={`${cssClasses.PREFIX_MODAL}-indicator`}>
                                {this.renderIndicator()}
                            </div>
                        </>
                        }
                        {
                            (title || description) && (
                                <div className={`${cssClasses.PREFIX_MODAL}-body`}>
                                    {title && <div className={`${cssClasses.PREFIX_MODAL}-body-title`}>{title}</div>}
                                    {description && <div className={`${cssClasses.PREFIX_MODAL}-body-description`}>{description}</div>}
                                </div>
                            )
                        }
                        <div className={`${cssClasses.PREFIX_MODAL}-footer`}>
                            {showSkipButton && !isLast && (
                                <Button 
                                    type='tertiary'
                                    onClick={this.foundation.handleSkip}
                                >
                                    {locale.skip}
                                </Button>
                            )}
                            {showPrevButton && !isFirst && (
                                <Button 
                                    type='tertiary'
                                    onClick={this.foundation.handlePrev}
                                    {...prevButtonProps}
                                >
                                    {prevButtonProps?.children || locale.prev}
                                </Button>
                            )}
                            <Button 
                                theme='solid'
                                onClick={this.foundation.handleNext}
                                {...nextButtonProps}
                            >
                                {isLast ? (finishText || locale.finish) : (nextButtonProps?.children || locale.next)}
                            </Button>
                        </div>
                    </Modal>
                )}
            </LocaleConsumer>
        );

    }

    render() {
        const { mode, steps, visible } = this.props;

        if (!visible || !steps.length) {
            return null;
        }

        return (
            <>
                {
                    mode === 'popup' ? (
                        <React.Fragment>
                            {steps?.map((step, index) => this.renderStep(step, index))}
                            {this.renderSpotlight()}
                        </React.Fragment>
                    ) : null
                }
                { mode === 'modal' && this.renderModal()}
            </>
        );
    }
}

export default UserGuide; 