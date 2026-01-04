/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { ReactNode } from "react";
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/carousel/constants';
import { CarouselIndicatorProps } from "./interface";
import getDataAttr from "@douyinfe/semi-foundation/utils/getDataAttr";

class CarouselIndicator extends React.PureComponent<CarouselIndicatorProps> {
    static propTypes = {
        activeKey: PropTypes.number,
        className: PropTypes.string,
        position: PropTypes.oneOf(strings.POSITION_MAP),
        size: PropTypes.oneOf(strings.SIZE),
        style: PropTypes.object,
        theme: PropTypes.oneOf(strings.THEME_MAP),
        total: PropTypes.number,
        onIndicatorChange: PropTypes.func,
        type: PropTypes.oneOf(strings.TYPE_MAP),
        trigger: PropTypes.oneOf(strings.TRIGGER)
    };

    onIndicatorChange = (activeIndex: number): void => {
        this.props.onIndicatorChange(activeIndex);
    };

    handleIndicatorClick = (activeIndex: number): void => {
        const { trigger } = this.props;
        if (trigger === 'click') {
            this.onIndicatorChange(activeIndex);
        }
    }

    handleIndicatorHover = (activeIndex: number): void => {
        const { trigger } = this.props;
        if (trigger === 'hover') {
            this.onIndicatorChange(activeIndex);
        }
    }

    renderIndicatorContent(): ReactNode {
        const { total, theme, size, activeIndex } = this.props;
        const indicatorContent: ReactNode[] = [];
        for (let i = 0; i < total; i++) {
            indicatorContent.push(
                <span
                    // role='none' 
                    key={i}
                    data-index={i}
                    className={cls([`${cssClasses.CAROUSEL_INDICATOR}-item`], {
                        [`${cssClasses.CAROUSEL_INDICATOR}-item-active`]: i === activeIndex,
                        [`${cssClasses.CAROUSEL_INDICATOR}-item-${theme}`]: theme,
                        [`${cssClasses.CAROUSEL_INDICATOR}-item-${size}`]: size,
                    })}
                    onClick={()=>this.handleIndicatorClick(i)}
                    onMouseEnter={()=>this.handleIndicatorHover(i)}
                ></span>
            );
        }
        return indicatorContent;
    }

    render(): ReactNode {
        const { type, size, theme, style, className, position, ...restProps } = this.props;
        const classNames = cls(className, {
            [cssClasses.CAROUSEL_INDICATOR]: true,
            [`${cssClasses.CAROUSEL_INDICATOR}-${type}`]: type,
            [`${cssClasses.CAROUSEL_INDICATOR}-${position}`]: position,
        });

        const indicatorContent = this.renderIndicatorContent();

        return (
            <div className={classNames} style={style} {...getDataAttr(restProps)}>
                {indicatorContent}
            </div>
        );
    }

}

export default CarouselIndicator;