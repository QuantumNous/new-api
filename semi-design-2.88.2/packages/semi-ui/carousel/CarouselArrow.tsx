/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { ReactNode } from "react";
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/carousel/constants';
import { CarouselArrowProps } from "./interface";
import { IconChevronLeft, IconChevronRight } from "@douyinfe/semi-icons";
import { get } from 'lodash';

class CarouselArrow extends React.PureComponent<CarouselArrowProps> {
    renderLeftIcon = () => {
        return get(this.props, 'arrowProps.leftArrow.children', <IconChevronLeft aria-label="Previous index" size="inherit"/>);
    }

    renderRightIcon = () => {
        return get(this.props, 'arrowProps.rightArrow.children', <IconChevronRight aria-label="Next index" size="inherit"/>);
    }

    render(): ReactNode {
        const { type, theme, prev, next } = this.props;
        const classNames = cls( {
            [cssClasses.CAROUSEL_ARROW]: true,
            [`${cssClasses.CAROUSEL_ARROW}-${theme}`]: theme,
            [`${cssClasses.CAROUSEL_ARROW}-hover`]: type === 'hover',
        });

        const leftClassNames = cls( {
            [`${cssClasses.CAROUSEL_ARROW}-prev`]: true,
            [`${cssClasses.CAROUSEL_ARROW}-${theme}`]: theme,
        });

        const rightClassNames = cls( {
            [`${cssClasses.CAROUSEL_ARROW}-next`]: true,
            [`${cssClasses.CAROUSEL_ARROW}-${theme}`]: theme,
        });

        return (
            <div className={classNames}>
                <div 
                    // role='button'
                    className={leftClassNames} 
                    onClick={prev}
                    {...get(this.props, 'arrowProps.leftArrow.props')}
                    x-semi-prop="arrowProps.leftArrow.children"
                >
                    {this.renderLeftIcon()}
                </div>
                <div 
                    // role='button'
                    // tabIndex={0} 
                    className={rightClassNames} 
                    onClick={next}
                    {...get(this.props, 'arrowProps.rightArrow.props')}
                    x-semi-prop="arrowProps.rightArrow.children"
                >
                    {this.renderRightIcon()}
                </div>
            </div>
        );
    }

}

export default CarouselArrow;