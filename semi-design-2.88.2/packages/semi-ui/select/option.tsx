import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { isString } from 'lodash';
import { cssClasses } from '@douyinfe/semi-foundation/select/constants';
import LocaleConsumer from '../locale/localeConsumer';
import { IconTick } from '@douyinfe/semi-icons';
import Highlight, { HighlightProps } from '../highlight';
import { Locale } from '../locale/interface';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';
import type { BasicOptionProps } from '@douyinfe/semi-foundation/select/optionFoundation';

export interface OptionProps extends BasicOptionProps {
    [x: string]: any;
    value?: string | number;
    label?: string | number | React.ReactNode;
    children?: React.ReactNode;
    disabled?: boolean;
    showTick?: boolean;
    className?: string;
    style?: React.CSSProperties
}
class Option extends PureComponent<OptionProps> {
    static isSelectOption = true;

    static propTypes = {
        children: PropTypes.node,
        disabled: PropTypes.bool,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        selected: PropTypes.bool,
        label: PropTypes.node,
        empty: PropTypes.bool,
        emptyContent: PropTypes.node,
        onSelect: PropTypes.func,
        focused: PropTypes.bool,
        showTick: PropTypes.bool,
        className: PropTypes.string,
        style: PropTypes.object,
        onMouseEnter: PropTypes.func,
        prefixCls: PropTypes.string,
        renderOptionItem: PropTypes.func,
        inputValue: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX_OPTION
    };

    onClick({ value, label, children, ...rest }: Partial<OptionProps>, event: React.MouseEvent) {
        const { props } = this;
        const isDisabled = props.disabled;
        if (!isDisabled) {
            props.onSelect({ ...rest, value, label: label || children }, event);
        }
    }

    renderOptionContent({ config, children, inputValue, prefixCls }) {
        if (isString(children) && inputValue) {
            return (
                <Highlight
                    searchWords={config.searchWords as HighlightProps['searchWords']}
                    sourceString={config.sourceString as string}
                    highlightClassName={config.highlightClassName as string}
                />
            );
        }
        return children;
    }

    render() {
        const {
            children,
            disabled,
            value,
            selected,
            label,
            empty,
            emptyContent,
            onSelect,
            focused,
            showTick,
            className,
            style,
            onMouseEnter,
            prefixCls,
            renderOptionItem,
            inputValue,
            semiOptionId,
            ...rest
        } = this.props;
        const optionClassName = classNames(prefixCls, {
            [`${prefixCls}-disabled`]: disabled,
            [`${prefixCls}-selected`]: selected,
            [`${prefixCls}-focused`]: focused,
            [`${prefixCls}-empty`]: empty,
            [className]: className,
        });
        const selectedIconClassName = classNames([`${prefixCls}-icon`]);

        if (empty) {
            if (emptyContent === null) {
                return null;
            }
            return (
                <LocaleConsumer<Locale['Select']> componentName="Select">
                    {(locale: Locale['Select']) => (
                        <div className={optionClassName} x-semi-prop="emptyContent">
                            {emptyContent || locale.emptyText}
                        </div>
                    )}
                </LocaleConsumer>
            );
        }

        // Since there are empty, locale and other logic, the custom renderOptionItem is directly converged to the internal option instead of being placed in Select/index
        if (typeof renderOptionItem === 'function') {
            const customRenderClassName = classNames(className,
                {
                    [`${prefixCls}-custom`]: true,
                    [`${prefixCls}-custom-selected`]: selected
                }
            );
            return renderOptionItem({
                disabled,
                focused,
                selected,
                style,
                label,
                value,
                inputValue,
                onMouseEnter: (e: React.MouseEvent) => onMouseEnter(e),
                onClick: (e: React.MouseEvent) => this.onClick({ value, label, children, ...rest }, e),
                className: customRenderClassName,
                ...rest
            });
        }

        const config = {
            searchWords: [inputValue],
            sourceString: children,
            highlightClassName: `${prefixCls}-keyword`
        };

        return (
            // eslint-disable-next-line jsx-a11y/interactive-supports-focus,jsx-a11y/click-events-have-key-events
            <div
                className={optionClassName}
                onClick={e => {
                    this.onClick({ value, label, children, ...rest }, e);
                }}
                onMouseEnter={e => onMouseEnter && onMouseEnter(e)}
                role="option"
                id={semiOptionId}
                aria-selected={selected ? "true" : "false"}
                aria-disabled={disabled ? "true" : "false"}
                style={style}
                {...getDataAttr(rest)}
            >
                {showTick ? (
                    <div className={selectedIconClassName}>
                        <IconTick />
                    </div>
                ) : null}
                {isString(children) ? <div className={`${prefixCls}-text`}>{this.renderOptionContent({ children, config, inputValue, prefixCls })}</div> : children}
            </div>
        );
    }
}

export default Option;
