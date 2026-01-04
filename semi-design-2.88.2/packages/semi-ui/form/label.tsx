import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/form/constants';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';

const prefixCls = cssClasses.PREFIX;

export interface LabelProps {
    /** text-align of label */
    align?: string;
    className?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    id?: string;
    /** Whether to display the required * symbol */
    required?: boolean;
    /** Content of label */
    text?: React.ReactNode;
    /** Used to configure the htmlFor attribute of the label tag */
    name?: string;
    /** width of label */
    width?: number | string;
    style?: React.CSSProperties;
    extra?: React.ReactNode;
    optional?: boolean
}

export default class Label extends PureComponent<LabelProps> {
    static defaultProps = {
        required: false,
        name: '',
        align: 'left',
        className: '',
        optional: false,
    };

    static propTypes = {
        id: PropTypes.string,
        children: PropTypes.node,
        required: PropTypes.bool,
        text: PropTypes.node,
        disabled: PropTypes.bool,
        name: PropTypes.string,
        align: PropTypes.string,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        style: PropTypes.object,
        className: PropTypes.string,
        extra: PropTypes.node,
        optional: PropTypes.bool,
    };

    render() {
        const { children, required, text, disabled, name, width, align, style, className, extra, id, optional } = this.props;

        const labelCls = classNames(className, {
            [`${prefixCls}-field-label`]: true,
            [`${prefixCls}-field-label-left`]: align === 'left',
            [`${prefixCls}-field-label-right`]: align === 'right',
            [`${prefixCls}-field-label-required`]: required,
            [`${prefixCls}-field-label-disabled`]: disabled,
            [`${prefixCls}-field-label-with-extra`]: extra,
        });
        const labelStyle = style ? style : {};
        width ? labelStyle.width = width : null;

        const optionalText = (
            <LocaleConsumer<Locale['Form']> componentName="Form" >
                {(locale: Locale['Form']) => (
                    <span className={`${prefixCls}-field-label-optional-text`}>{locale.optional}</span>
                )}
            </LocaleConsumer>
        );

        const textContent = (
            <div className={`${prefixCls}-field-label-text`} x-semi-prop="label">
                {typeof text !== 'undefined' ? text : children}
                {optional ? optionalText : null}
            </div>
        );

        const contentWithExtra = (
            <>
                {textContent}
                <div className={`${prefixCls}-field-label-extra`}>{extra}</div>
            </>
        );

        return (
            <label className={labelCls} htmlFor={name} style={labelStyle} id={id}>
                {extra ? contentWithExtra : textContent}
            </label>
        );
    }
}
