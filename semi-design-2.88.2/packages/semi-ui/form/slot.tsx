import React, { useContext } from 'react';
import classNames from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/form/constants';
import { isString, isNumber, isObject } from 'lodash';
import Label, { LabelProps } from './label';
import { Col } from '../grid';
import { FormUpdaterContext } from './context';
import ErrorMessage, { ErrorMessageProps } from './errorMessage';

const prefix = cssClasses.PREFIX;

export interface SlotProps {
    className?: string;
    style?: React.CSSProperties;
    label?: LabelProps | React.ReactNode;
    noLabel?: boolean;
    labelPosition?: 'top' | 'left';
    error?: ErrorMessageProps;
    children?: React.ReactNode
}

const FormSlot = (props: SlotProps) => {
    let labelCol, wrapperCol, labelWidth, labelAlign, content;
    let labelPosition = 'top';

    try {
        const updater = useContext(FormUpdaterContext);
        const formProps = updater.getFormProps(['labelPosition', 'labelWidth', 'labelAlign', 'labelCol', 'wrapperCol']);
        labelCol = formProps.labelCol;
        wrapperCol = formProps.wrapperCol;
        labelWidth = formProps.labelWidth;
        labelAlign = formProps.labelAlign;
        labelPosition = formProps.labelPosition ? formProps.labelPosition : labelPosition;
    } catch (error) {
    }

    props.labelPosition ? labelPosition = props.labelPosition : null;

    let { children, label, className, style, error, noLabel, ...rest } = props;

    const appendCol = labelCol && wrapperCol;

    const slotCls = classNames(
        {
            [`${prefix}-field`]: true,
            [`${prefix}-slot`]: true,
        },
        className
    );

    const labelColCls = classNames({
        [`${prefix}-col-${labelAlign}`]: true,
    });

    switch (true) {
        case isObject(label) && !React.isValidElement(label):
            // do nothing
            break;
        case isString(label) || isNumber(label):
            // @ts-ignore skip type check, the actual type is already determined
            label = { text: label };
            break;
        case React.isValidElement(label):
            // @ts-ignore skip type check, the actual type is already determined
            label = { text: label };
            break;
        default:
            break;
    }

    let slotError = null;
    if (typeof error !== undefined) {
        let emProps = {};
        switch (true) {
            case isObject(error) && !React.isValidElement(error):
                // do nothing
                emProps = error;
                break;
            case isString(error) || isNumber(error):
                emProps = { error };
                break;
            case React.isValidElement(error):
                emProps = { error };
                break;
            default:
                break;
        }
        slotError = <ErrorMessage {...emProps} />;
    }

    let mergeLabelProps = {
        align: labelAlign,
        width: labelWidth,
        // @ts-ignore: After the above switch statement, label must be of object type
        ...label,
    };

    let mainCls = classNames({
        [`${prefix}-field-main`]: true,
        [`${prefix}-slot-main`]: true,
    });

    switch (true) {
        case !appendCol && !noLabel:
            content = (
                <>
                    <Label {...mergeLabelProps} />
                    <div className={mainCls}>
                        {children}
                        {slotError}
                    </div>
                </>
            );
            break;
        case !appendCol && noLabel:
            content = (
                <>
                    <div className={mainCls}>
                        {children}
                        {slotError}
                    </div>
                </>
            );
            break;
        case appendCol && labelPosition === 'top':
            // When labelPosition is top, you need to add an overflow hidden div to the label, otherwise it will be arranged horizontally
            content = (
                <>
                    <div style={{ overflow: 'hidden' }}>
                        <Col {...labelCol} className={labelColCls}>
                            <Label {...mergeLabelProps} />
                        </Col>
                    </div>
                    <Col>
                        {children}
                        {slotError}
                    </Col>
                </>
            );
            break;
        case appendCol && labelPosition !== 'top':
            content = (
                <>
                    <Col {...labelCol} className={labelColCls}>
                        <Label {...mergeLabelProps} />
                    </Col>
                    <Col>
                        {children}
                        {slotError}
                    </Col>
                </>
            );
            break;
        default:
            break;
    }

    return (
        <div className={slotCls} x-label-pos={labelPosition} style={style}>
            {content}
        </div>
    );
};

export default FormSlot;
