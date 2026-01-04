import React, { ReactNode, Children, ReactChild, ReactFragment, ReactPortal, isValidElement } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import BaseComponent from "../_base/baseComponent";
import { CarouselProps } from './interface';
import { cssClasses, numbers, strings } from '@douyinfe/semi-foundation/carousel/constants';
import CarouselFoundation, { CarouselAdapter } from '@douyinfe/semi-foundation/carousel/foundation';
import CarouselIndicator from './CarouselIndicator';
import CarouselArrow from './CarouselArrow';
import '@douyinfe/semi-foundation/carousel/carousel.scss';
import { debounce, isEqual, pick } from 'lodash';
import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';

export interface CarouselState {
    activeIndex: number;
    preIndex: number;
    isReverse: boolean;
    isInit: boolean
}

class Carousel extends BaseComponent<CarouselProps, CarouselState> {
    static propTypes = {
        activeIndex: PropTypes.number,
        animation: PropTypes.oneOf(strings.ANIMATION_MAP),
        arrowProps: PropTypes.object,
        autoPlay: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
        className: PropTypes.string,
        defaultActiveIndex: PropTypes.number,
        indicatorPosition: PropTypes.oneOf(strings.POSITION_MAP),
        indicatorSize: PropTypes.oneOf(strings.SIZE),
        indicatorType: PropTypes.oneOf(strings.TYPE_MAP),
        theme: PropTypes.oneOf(strings.THEME_MAP),
        onChange: PropTypes.func,
        arrowType: PropTypes.oneOf(strings.ARROW_MAP),
        showArrow: PropTypes.bool,
        showIndicator: PropTypes.bool,
        slideDirection: PropTypes.oneOf(strings.DIRECTION),
        speed: PropTypes.number,
        style: PropTypes.object,
        trigger: PropTypes.oneOf(strings.TRIGGER)
    };

    static defaultProps: CarouselProps = {
        children: [],
        animation: 'slide',
        autoPlay: true,
        arrowType: 'always',
        defaultActiveIndex: numbers.DEFAULT_ACTIVE_INDEX,
        indicatorPosition: 'center',
        indicatorSize: 'small',
        indicatorType: 'dot',
        theme: 'light',
        onChange: () => undefined,
        showArrow: true,
        showIndicator: true,
        slideDirection: 'left',
        speed: numbers.DEFAULT_SPEED,
        trigger: 'click'
    };

    foundation: CarouselFoundation;

    constructor(props: CarouselProps) {
        super(props);

        this.foundation = new CarouselFoundation(this.adapter);
        const defaultActiveIndex = this.foundation.getDefaultActiveIndex();

        this.state = {
            activeIndex: defaultActiveIndex,
            preIndex: defaultActiveIndex,
            isReverse: false,
            isInit: true
        };
    }

    get adapter(): CarouselAdapter<CarouselProps, CarouselState> {
        return {
            ...super.adapter,
            notifyChange: (activeIndex: number, preIndex: number): void => {
                this.props.onChange(activeIndex, preIndex);
            },
            setNewActiveIndex: (activeIndex: number): void => {
                this.setState({ activeIndex });
            },
            setPreActiveIndex: (preIndex: number): void => {
                this.setState({ preIndex });
            },
            setIsReverse: (isReverse: boolean): void => {
                this.setState({ isReverse });
            },
            setIsInit: (isInit: boolean): void => {
                this.setState({ isInit });
            },
            getChildren: (): any[] => {
                return this.getChildren() as any[];
            }
        };
    }

    static getDerivedStateFromProps(props: CarouselProps, state: CarouselState): Partial<CarouselState> {
        const states: Partial<CarouselState> = {};
        if (!isNullOrUndefined(props.activeIndex) && props.activeIndex !== state.activeIndex) {
            states.activeIndex = props.activeIndex;
        }
        return states;
    }

    componentDidMount(): void {
        this.handleAutoPlay();
    }

    componentWillUnmount(): void {
        this.foundation.destroy();
    }

    play = (): void => {
        this.foundation.setForcePlay(true);
        return this.foundation.handleAutoPlay();
    }

    stop = (): void => {
        this.foundation.setForcePlay(false);
        return this.foundation.stop();
    };

    goTo = (targetIndex: number): void => {
        return this.foundation.goTo(targetIndex);
    };

    prev = (): void => {
        return this.foundation.prev();
    };

    next = (): void => {
        return this.foundation.next();
    };

    handleAutoPlay = (): void => {
        if (!this.foundation.getIsControlledComponent()) {
            this.foundation.handleAutoPlay();
        }
    }

    handleMouseEnter = (): void => {
        const { autoPlay } = this.props;
        if ((autoPlay === true) || (typeof autoPlay === 'object' && autoPlay.hoverToPause)) {
            this.foundation.stop();
        }
    }

    handleMouseLeave = (): void => {
        const { autoPlay } = this.props;
        if ((typeof autoPlay !== 'object' || autoPlay.hoverToPause) && !this.foundation.getIsControlledComponent()) {
            this.foundation.handleAutoPlay();
        }
    }

    onIndicatorChange = (activeIndex: number): void => {
        return this.foundation.onIndicatorChange(activeIndex);
    };

    getChildren = (): (ReactChild | ReactFragment | ReactPortal)[] => {
        const { children: originChildren } = this.props;
        return Children.toArray(originChildren).filter(child => {
            return React.isValidElement(child);
        });
    }

    getValidIndex = (activeIndex: number): number => {
        return this.foundation.getValidIndex(activeIndex);
    };


    renderChildren = () => {
        const { speed, animation } = this.props;
        const { activeIndex, preIndex, isInit } = this.state;

        const children = this.getChildren();

        return (
            <>
                {children.map((child: any, index: number) => {
                    const isCurrent = index === activeIndex;
                    const isPrev = index === this.getValidIndex(activeIndex - 1);
                    const isNext = index === this.getValidIndex(activeIndex + 1);

                    const animateStyle = {
                        transitionTimingFunction: 'ease',
                        transitionDuration: `${speed}ms`,
                        animationTimingFunction: 'ease',
                        animationDuration: `${speed}ms`,
                    };

                    return React.cloneElement(child, {
                        style: {
                            ...child.props.style,
                            ...animateStyle,
                        },
                        className: cls(child.props.className, {
                            [`${cssClasses.CAROUSEL_CONTENT}-item-prev`]: isPrev,
                            [`${cssClasses.CAROUSEL_CONTENT}-item-next`]: isNext,
                            [`${cssClasses.CAROUSEL_CONTENT}-item-current`]: isCurrent,
                            [`${cssClasses.CAROUSEL_CONTENT}-item`]: true,
                            [`${cssClasses.CAROUSEL_CONTENT}-item-active`]: isCurrent,
                            [`${cssClasses.CAROUSEL_CONTENT}-item-slide-in`]: animation === 'slide' && !isInit && isCurrent,
                            [`${cssClasses.CAROUSEL_CONTENT}-item-slide-out`]: animation === 'slide' && !isInit && index === preIndex,
                        })
                    });
                })}
            </>
        );
    }

    renderIndicator = () => {
        const { activeIndex } = this.state;
        const { showIndicator, indicatorType, theme, indicatorPosition, indicatorSize, trigger } = this.props;

        const carouselIndicatorCls = cls({
            [cssClasses.CAROUSEL_INDICATOR]: true
        });
        const children = this.getChildren();

        if (showIndicator && children.length > 1) {
            return (
                <div className={carouselIndicatorCls}>
                    <CarouselIndicator
                        type={indicatorType}
                        total={children.length}
                        activeIndex={activeIndex}
                        position={indicatorPosition}
                        trigger={trigger}
                        size={indicatorSize}
                        theme={theme}
                        onIndicatorChange={this.onIndicatorChange}
                    />
                </div>
            );
        }
        return null;
    }

    renderArrow = () => {
        const { showArrow, arrowType, theme, arrowProps } = this.props;
        const children = this.getChildren();

        if (showArrow && children.length > 1) {
            return (
                <CarouselArrow
                    type={arrowType}
                    theme={theme}
                    prev={this.prev}
                    next={this.next}
                    arrowProps={arrowProps}
                />
            );
        }
        return null;
    };


    render(): ReactNode {
        const { animation, className, style, slideDirection } = this.props;
        const { isReverse } = this.state;

        const carouselWrapperCls = cls(className, {
            [cssClasses.CAROUSEL]: true
        });

        return (
            <div
                // role='listbox'
                // tabIndex={0}
                className={carouselWrapperCls}
                style={style}
                onMouseEnter={debounce(this.handleMouseEnter, 400)}
                onMouseLeave={debounce(this.handleMouseLeave, 400)}
                {...this.getDataAttr(this.props)}
            // onMouseEnter={this.handleMouseEnter}
            // onMouseLeave={this.handleMouseLeave}
            // onKeyDown={e => this.foundation.handleKeyDown(e)}
            >
                <div
                    className={cls([`${cssClasses.CAROUSEL_CONTENT}-${animation}`], {
                        [`${cssClasses.CAROUSEL_CONTENT}`]: true,
                        [`${cssClasses.CAROUSEL_CONTENT}-reverse`]: slideDirection === 'left' ? isReverse : !isReverse,
                    })}
                    x-semi-prop="children"
                >
                    {this.renderChildren()}
                </div>
                {this.renderIndicator()}
                {this.renderArrow()}
            </div>
        );
    }
}

export default Carousel;