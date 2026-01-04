import React from 'react';
import ReactDOM from 'react-dom';
import BaseComponent from '../_base/baseComponent';
import cls from 'classnames';
import ConfigContext from '../configProvider/context';
import { cssClasses, strings } from '@douyinfe/semi-foundation/rating/constants';
import PropTypes from 'prop-types';
import { noop } from '@douyinfe/semi-foundation/utils/function';
import Item from './item';
import Tooltip from '../tooltip';
import RatingFoundation, { RatingAdapter } from '@douyinfe/semi-foundation/rating/foundation';

import '@douyinfe/semi-foundation/rating/rating.scss';

export type { RatingItemProps } from './item';
export interface RatingProps {
    'aria-describedby'?: string;
    'aria-errormessage'?: string;
    'aria-invalid'?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-required'?: boolean;
    disabled?: boolean;
    value?: number;
    defaultValue?: number;
    count?: number;
    allowHalf?: boolean;
    allowClear?: boolean;
    style?: React.CSSProperties;
    prefixCls?: string;
    onChange?: (value: number) => void;
    onHoverChange?: (value: number) => void;
    className?: string;
    character?: React.ReactNode;
    tabIndex?: number;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onClick?: (e: React.MouseEvent | React.KeyboardEvent, index: number) => void;
    autoFocus?: boolean;
    size?: 'small' | 'default' | number;
    tooltips?: string[];
    id?: string;
    preventScroll?: boolean
}

export interface RatingState {
    value: number;
    hoverValue: number;
    focused: boolean;
    clearedValue: number;
    emptyStarFocusVisible: boolean
}

export default class Rating extends BaseComponent<RatingProps, RatingState> {
    static contextType = ConfigContext;
    static propTypes = {
        'aria-describedby': PropTypes.string,
        'aria-errormessage': PropTypes.string,
        'aria-invalid': PropTypes.bool,
        'aria-label': PropTypes.string,
        'aria-labelledby': PropTypes.string,
        'aria-required': PropTypes.bool,
        disabled: PropTypes.bool,
        value: PropTypes.number,
        defaultValue: PropTypes.number,
        count: PropTypes.number,
        allowHalf: PropTypes.bool,
        allowClear: PropTypes.bool,
        style: PropTypes.object,
        prefixCls: PropTypes.string,
        onChange: PropTypes.func,
        onHoverChange: PropTypes.func,
        className: PropTypes.string,
        character: PropTypes.node,
        tabIndex: PropTypes.number,
        onFocus: PropTypes.func,
        onBlur: PropTypes.func,
        onKeyDown: PropTypes.func,
        autoFocus: PropTypes.bool,
        size: PropTypes.oneOfType([PropTypes.oneOf(strings.SIZE_SET), PropTypes.number]),
        tooltips: PropTypes.arrayOf(PropTypes.string),
        id: PropTypes.string,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        defaultValue: 0,
        count: 5,
        allowHalf: false,
        allowClear: true,
        style: {},
        prefixCls: cssClasses.PREFIX,
        onChange: noop,
        onHoverChange: noop,
        tabIndex: -1,
        size: 'default' as const,
    };

    stars: Record<string, Item>;
    rate: HTMLUListElement = null;

    foundation: RatingFoundation;

    constructor(props: RatingProps) {
        super(props);
        const value = props.value === undefined ? props.defaultValue : props.value;
        this.stars = {};
        this.state = {
            value,
            focused: false,
            hoverValue: undefined,
            clearedValue: null,
            emptyStarFocusVisible: false,
        };

        this.foundation = new RatingFoundation(this.adapter);
    }

    static getDerivedStateFromProps(nextProps: RatingProps, state: RatingState) {
        if ('value' in nextProps && nextProps.value !== undefined) {
            return {
                ...state,
                value: nextProps.value,
            };
        }
        return state;
    }

    get adapter(): RatingAdapter<RatingProps, RatingState> {
        return {
            ...super.adapter,
            focus: () => {
                const { disabled, count } = this.props;
                const { value } = this.state;
                if (!disabled) {
                    const index = Math.ceil(value) - 1;
                    this.stars[index < 0 ? count : index].starFocus();
                }
            },
            getStarDOM: (index: number) => {
                const instance = this.stars && this.stars[index];
                return instance.getDomNode() as Element;
            },
            notifyHoverChange: (hoverValue: number, clearedValue: number) => {
                const { onHoverChange } = this.props;
                this.setState({
                    hoverValue,
                    clearedValue,
                });
                onHoverChange(hoverValue);
            },
            updateValue: (value: number) => {
                const { onChange } = this.props;
                if (!('value' in this.props)) {
                    this.setState({
                        value,
                    });
                }
                onChange(value);
            },
            clearValue: (clearedValue: number) => {
                this.setState({
                    clearedValue,
                });
            },
            notifyFocus: (e: React.FocusEvent) => {
                const { onFocus } = this.props;
                this.setState({
                    focused: true,
                });
                onFocus && onFocus(e);
            },
            notifyBlur: (e: React.FocusEvent) => {
                const { onBlur } = this.props;
                this.setState({
                    focused: false,
                });
                onBlur && onBlur(e);
            },
            notifyKeyDown: (e: React.KeyboardEvent) => {
                const { onKeyDown } = this.props;
                this.setState({
                    focused: false,
                });
                onKeyDown && onKeyDown(e);
            },
            setEmptyStarFocusVisible: (focusVisible: boolean): void => {
                this.setState({
                    emptyStarFocusVisible: focusVisible, 
                });
            },
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    onHover = (event: React.MouseEvent, index: number) => {
        this.foundation.handleHover(event, index);
    };

    onMouseLeave = () => {
        this.foundation.handleMouseLeave();
    };

    onClick: RatingProps['onClick'] = (event, index) => {
        this.foundation.handleClick(event, index);
    };

    onFocus: RatingProps['onFocus'] = e => {
        this.foundation.handleFocus(e);
    };

    onBlur: RatingProps['onBlur'] = e => {
        this.foundation.handleBlur(e);
    };

    onKeyDown: RatingProps['onKeyDown'] = event => {
        const { value } = this.state;
        this.foundation.handleKeyDown(event, value);
    };

    focus = () => {
        const { disabled, preventScroll } = this.props;
        if (!disabled) {
            this.rate.focus({ preventScroll });
        }
    };

    blur = () => {
        const { disabled } = this.props;
        if (!disabled) {
            this.rate.blur();
        }
    };

    saveRef = (index: number) => (node: Item) => {
        this.stars[index] = node;
    };

    saveRate = (node: HTMLUListElement) => {
        this.rate = node;
    };

    handleStarFocusVisible = (event: React.FocusEvent) => {
        this.foundation.handleStarFocusVisible(event);
    }

    handleStarBlur = (event: React.FocusEvent) => {
        this.foundation.handleStarBlur(event);
    }

    getAriaLabelPrefix = () => {
        if (this.props['aria-label']) {
            return this.props['aria-label'];
        }
        let prefix = 'star';
        const { character } = this.props;
        if (typeof character === 'string') {
            prefix = character;
        }
        return prefix;
    }

    getItemList = (ariaLabelPrefix: string) => {
        const { count, allowHalf, prefixCls, disabled, character, size, tooltips } = this.props;
        const { value, hoverValue, focused } = this.state;
        // index == count is for Empty rating
        const itemList = [...Array(count + 1).keys()].map(ind => {
            const content = (
                <Item
                    ref={this.saveRef(ind)}
                    index={ind}
                    count={count}
                    prefixCls={`${prefixCls}-star`}
                    allowHalf={allowHalf}
                    value={hoverValue === undefined ? value : hoverValue}
                    onClick={disabled ? noop : this.onClick}
                    onHover={disabled ? noop : this.onHover}
                    key={ind}
                    disabled={disabled}
                    character={character}
                    focused={focused}
                    size={ind === count ? 0 : size}
                    ariaLabelPrefix={ariaLabelPrefix}
                    onFocus={disabled || count !== ind ? noop : this.handleStarFocusVisible}
                    onBlur={disabled || count !== ind ? noop : this.handleStarBlur}
                />
            );
            if (tooltips) {
                const text = tooltips[ind] ? tooltips[ind] : '';
                const showTips = hoverValue - 1 === ind;
                return (
                    <Tooltip visible={showTips} trigger="custom" content={text} key={`${ind}-${showTips}`}>
                        <span className={`${prefixCls}-star-outer`}>{content}</span>
                    </Tooltip>
                );
            }
            return content;
        });
        return itemList;
    }

    render() {
        const { style, prefixCls, disabled, className, id, count, tabIndex, ...rest } = this.props;
        const { value, emptyStarFocusVisible } = this.state;
        const ariaLabelPrefix = this.getAriaLabelPrefix();
        const ariaLabel = `Rating: ${value} of ${count} ${ariaLabelPrefix}${value === 1 ? '' : 's'},`;
        const itemList = this.getItemList(ariaLabelPrefix);
        const listCls = cls(
            prefixCls,
            {
                [`${prefixCls}-disabled`]: disabled,
                [`${prefixCls}-focus`]: emptyStarFocusVisible,
            },
            className
        );
        return (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <ul 
                aria-label={ariaLabel}
                aria-labelledby={this.props['aria-labelledby']}
                aria-describedby={this.props['aria-describedby']}
                className={listCls}
                style={style}
                onMouseLeave={disabled ? noop : this.onMouseLeave}
                tabIndex={disabled ? -1 : tabIndex}
                onFocus={disabled ? noop : this.onFocus}
                onBlur={disabled ? noop : this.onBlur}
                onKeyDown={disabled ? noop : this.onKeyDown}
                ref={this.saveRate as any}
                id={id}
                {...this.getDataAttr(rest)}
            >
                {itemList}
            </ul>
        );
    }
}
