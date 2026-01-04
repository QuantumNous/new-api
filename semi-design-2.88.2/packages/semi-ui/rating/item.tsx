import React, { PureComponent } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/rating/constants';
import '@douyinfe/semi-foundation/rating/rating.scss';
import { IconStar } from '@douyinfe/semi-icons';
import { RatingItemFoundation, RatingItemAdapter } from '@douyinfe/semi-foundation/rating/foundation';
import BaseComponent, { BaseProps } from '../_base/baseComponent';


type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export interface RatingItemProps extends BaseProps {
    value: number;
    index: number;
    prefixCls: string;
    allowHalf: boolean;
    onHover: (e: React.MouseEvent, index: number) => void;
    onClick: (e: React.MouseEvent | React.KeyboardEvent, index: number) => void;
    character: React.ReactNode;
    focused: boolean;
    disabled: boolean;
    count: number;
    ariaLabelPrefix: string;
    size: number | ArrayElement<typeof strings.SIZE_SET>;
    'aria-describedby'?: React.AriaAttributes['aria-describedby'];
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    preventScroll?: boolean
}

export interface RatingItemState {
    firstStarFocus: boolean;
    secondStarFocus: boolean
}

export default class Item extends BaseComponent<RatingItemProps, RatingItemState> {
    static propTypes = {
        value: PropTypes.number,
        index: PropTypes.number,
        prefixCls: PropTypes.string,
        allowHalf: PropTypes.bool,
        onHover: PropTypes.func,
        onClick: PropTypes.func,
        character: PropTypes.node,
        focused: PropTypes.bool,
        disabled: PropTypes.bool,
        count: PropTypes.number,
        ariaLabelPrefix: PropTypes.string,
        size: PropTypes.oneOfType([
            PropTypes.oneOf(strings.SIZE_SET),
            PropTypes.number,
        ]),
        'aria-describedby': PropTypes.string,
        onFocus: PropTypes.func,
        onBlur: PropTypes.func,
        preventScroll: PropTypes.bool,
    };

    foundation: RatingItemFoundation;

    constructor(props: RatingItemProps) {
        super(props);
        this.liRef = React.createRef();
        this.state = {
            firstStarFocus: false,
            secondStarFocus: false,
        };
        this.foundation = new RatingItemFoundation(this.adapter);
    }

    public getDomNode = () => {
        return this.liRef && this.liRef.current;
    }
    
    liRef: React.RefObject<HTMLLIElement>;

    get adapter(): RatingItemAdapter<RatingItemProps, RatingItemState> {
        return {
            ...super.adapter,
            setFirstStarFocus: (value) => {
                this.setState({
                    firstStarFocus: value,
                });
            },
            setSecondStarFocus: (value) => {
                this.setState({
                    secondStarFocus: value,
                });
            }
        };
    }

    firstStar: HTMLDivElement = null;
    secondStar: HTMLDivElement = null;

    onHover: React.MouseEventHandler = e => {
        const { onHover, index } = this.props;
        onHover(e, index);
    };

    onClick: React.MouseEventHandler = e => {
        const { onClick, index } = this.props;
        onClick(e, index);
    };

    onFocus = (e, star) => {
        const { onFocus } = this.props;
        onFocus && onFocus(e);
        this.foundation.handleFocusVisible(e, star);
    } 

    onBlur = (e, star) => {
        const { onBlur } = this.props;
        onBlur && onBlur(e);
        this.foundation.handleBlur(e, star);
    } 


    onKeyDown: React.KeyboardEventHandler = e => {
        const { onClick, index } = this.props;
        if (e.keyCode === 13) {
            onClick(e, index);
        }
    };

    starFocus = () => {
        const { value, index, preventScroll } = this.props;
        if (value - index === 0.5) {
            this.firstStar.focus({ preventScroll });
        } else {
            this.secondStar.focus({ preventScroll });
        }
    }

    saveFirstStar = (node: HTMLDivElement) => {
        this.firstStar = node;
    };

    saveSecondStar = (node: HTMLDivElement) => {
        this.secondStar = node;
    };

    render() {
        const {
            index,
            prefixCls,
            character,
            count,
            value,
            disabled,
            allowHalf,
            focused,
            size,
            ariaLabelPrefix,
        } = this.props;
        const { firstStarFocus, secondStarFocus } = this.state;
        const starValue = index + 1;
        const diff = starValue - value;
        // const isHalf = allowHalf && value + 0.5 === starValue;
        const isHalf = allowHalf && diff < 1 && diff > 0;
        const firstWidth = 1 - diff;
        const isFull = starValue <= value;
        const isCustomSize = typeof size === 'number';
        const starCls = cls(prefixCls, {
            [`${prefixCls}-half`]: isHalf,
            [`${prefixCls}-full`]: isFull,
            [`${prefixCls}-${size}`]: !isCustomSize,
        });
        const sizeStyle = isCustomSize ? {
            width: size,
            height: size,
            fontSize: size
        } : {};
        const iconSize = isCustomSize ? 'inherit' : (size === 'small' ? 'default' : 'extra-large');
        const content = character ? character : <IconStar size={iconSize} style={{ display: 'block' }}/>;
        const isEmpty = index === count;
        const starWrapCls = cls(`${prefixCls}-wrapper`, {
            [`${prefixCls}-disabled`]: disabled,
            [`${cssClasses.PREFIX}-focus`]: (firstStarFocus || secondStarFocus) && value !== 0,
        });
        const starWrapProps = {
            onClick: disabled ? null : this.onClick,
            onKeyDown: disabled ? null : this.onKeyDown,
            onMouseMove: disabled ? null : this.onHover,
            className: starWrapCls,
        };
        const AriaSetSize = allowHalf ? count * 2 + 1 : count + 1;
        const firstStarProps = {
            ref: this.saveFirstStar as any,
            role: "radio",
            'aria-checked': value === index + 0.5,
            'aria-posinset': 2 * index + 1,
            'aria-setsize': AriaSetSize,
            'aria-disabled': disabled,
            'aria-label': `${index + 0.5} ${ariaLabelPrefix}s`,
            'aria-labelledby': this.props['aria-describedby'],
            'aria-describedby': this.props['aria-describedby'],
            className: cls(`${prefixCls}-first`, `${cssClasses.PREFIX}-no-focus`),
            tabIndex: !disabled && value === index + 0.5 ? 0 : -1,
            onFocus: (e) => {
                this.onFocus(e, 'first');
            },
            onBlur: (e) => {
                this.onBlur(e, 'first');
            },
        };

        const secondStarTabIndex = !disabled && ((value === index + 1) || (isEmpty && value === 0)) ? 0 : -1;
        const secondStarProps = {
            ref: this.saveSecondStar as any,
            role: "radio",
            'aria-checked': isEmpty ? value === 0 : value === index + 1,
            'aria-posinset': allowHalf ? 2 * (index + 1) : index + 1,
            'aria-setsize': AriaSetSize, 
            'aria-disabled': disabled,
            'aria-label': `${isEmpty ? 0 : index + 1} ${ariaLabelPrefix}${index === 0 ? '' : 's'}`,
            'aria-labelledby': this.props['aria-describedby'],
            'aria-describedby': this.props['aria-describedby'],
            className: cls(`${prefixCls}-second`, `${cssClasses.PREFIX}-no-focus`),
            tabIndex: secondStarTabIndex,
            onFocus: (e) => {
                this.onFocus(e, 'second');
            },
            onBlur: (e) => {
                this.onBlur(e, 'second');
            },
        };
       
        return (
            <li className={starCls} style={{ ...sizeStyle }} key={index} ref={this.liRef}>
                <div {...(starWrapProps as any)}>
                    {allowHalf && !isEmpty && <div {...firstStarProps} style={{ width: `${firstWidth * 100}%` }}>{content}</div>}
                    <div {...secondStarProps} x-semi-prop="character">{content}</div>
                </div>
            </li>
        );
    }
}