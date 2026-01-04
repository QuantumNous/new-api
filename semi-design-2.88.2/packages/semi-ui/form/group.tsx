import React, { Component } from 'react';
import classNames from 'classnames';
import { isString } from 'lodash';
import { isValid } from '@douyinfe/semi-foundation/form/utils';
import { cssClasses } from '@douyinfe/semi-foundation/form/constants';
import * as ObjectUtil from '@douyinfe/semi-foundation/utils/object';
import ErrorMessage, { ReactFieldError } from './errorMessage';
import Label, { LabelProps } from './label';
import { FormUpdaterContext } from './context';
import { useFormState } from './hooks/index';
import InputGroup, { InputGroupProps as BacisInputGroupProps } from '../input/inputGroup';
import { BaseFormProps, FormState } from './interface';
import { FormUpdaterContextType } from '@douyinfe/semi-foundation/form/interface';
import { Col, Row } from '../grid/index';
interface GroupErrorProps {
    showValidateIcon?: boolean;
    isInInputGroup?: boolean;
    error?: ReactFieldError;
    fieldSet?: string[]
}
export interface InputGroupProps extends BacisInputGroupProps {
    label?: LabelProps;
    labelPosition?: 'left' | 'top';
    extraText?: React.ReactNode;
    extraTextPosition?: 'bottom' | 'middle'
}

const prefix = cssClasses.PREFIX;

// Group component to remove Labels and ErrorMessages from its child fields
// Unified insertion of Labels and ErrorMessages from the group level

// Get Errors of all field in this group
const GroupError = (props: GroupErrorProps) => {
    const { fieldSet } = props;
    const formState: FormState = useFormState();
    const error = fieldSet.map((field: string) => ObjectUtil.get(formState.errors, field));

    if (isValid(error)) {
        return null;
    }
    return (
        <ErrorMessage error={error} showValidateIcon={props.showValidateIcon} isInInputGroup={props.isInInputGroup} />
    );
};

class FormInputGroup extends Component<InputGroupProps> {
    static contextType = FormUpdaterContext;
    context: FormUpdaterContextType;

    static defaultProps = {
        extraTextPosition: 'bottom'
    }

    renderLabel(label: LabelProps, formProps: BaseFormProps) {
        if (label) {
            if (isString(label)) {
                return (<Label width={formProps.labelWidth} text={label} />);
            } else {
                return (<Label width={formProps.labelWidth} {...label} />);
            }
        }
        return null;
    }

    render() {
        const { children, label, extraText, extraTextPosition, ...rest } = this.props;
        const updater = this.context;
        const formProps = updater.getFormProps(['labelPosition', 'labelWidth', 'labelAlign', 'showValidateIcon', 'wrapperCol', 'labelCol', 'disabled']);
        const labelPosition = this.props.labelPosition || formProps.labelPosition;
        const groupFieldSet: Array<string> = [];
        const inner = React.Children.map(children, (child: any) => {
            if (child && child.props && child.props.field) {
                groupFieldSet.push(child.props.field);
                return React.cloneElement(child, {
                    isInInputGroup: true,
                    // noErrorMessage: true,
                    // noLabel: true
                });
            }
            return null;
        });

        const groupCls = classNames({
            [`${prefix}-field-group`]: true
        });

        const labelCol = formProps.labelCol;
        const wrapperCol = formProps.wrapperCol;
        const labelAlign = formProps.labelAlign;
        const appendCol = labelCol && wrapperCol;

        const labelColCls = labelCol ? `${prefix}-col-${labelAlign}` : '';

        const labelContent = this.renderLabel(label, formProps);
        const inputGroupContent = (
            <InputGroup disabled={formProps.disabled} {...rest}>
                {inner}
            </InputGroup>
        );
        const groupErrorContent = (<GroupError fieldSet={groupFieldSet} showValidateIcon={formProps.showValidateIcon} isInInputGroup />);

        const extraCls = classNames(`${prefix}-field-extra`, {
            [`${prefix}-field-extra-string`]: typeof extraText === 'string',
            [`${prefix}-field-extra-middle`]: extraTextPosition === 'middle',
            [`${prefix}-field-extra-bottom`]: extraTextPosition === 'bottom',
        });

        const extraContent = extraText ? <div className={extraCls} x-semi-prop="extraText">{extraText}</div> : null;

        let content: any;

        switch (true) {
            case !appendCol:
                content = (
                    <>
                        {labelContent}
                        <div>
                            {extraTextPosition === 'middle' ? extraContent : null}
                            {inputGroupContent}
                            {extraTextPosition === 'bottom' ? extraContent : null}
                            {groupErrorContent}
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
                                {labelContent}
                            </Col>
                        </div>
                        <Col {...wrapperCol}>
                            {extraTextPosition === 'middle' ? extraContent : null}
                            {inputGroupContent}
                            {extraTextPosition === 'bottom' ? extraContent : null}
                            {groupErrorContent}
                        </Col>
                    </>
                );
                break;
            case appendCol && labelPosition !== 'top':
                content = (
                    <>
                        <Col {...labelCol} className={labelColCls}>
                            {labelContent}
                        </Col>
                        <Col {...wrapperCol}>
                            {extraTextPosition === 'middle' ? extraContent : null}
                            {inputGroupContent}
                            {extraTextPosition === 'bottom' ? extraContent : null}
                            {groupErrorContent}
                        </Col>
                    </>
                );
                break;
            default:
                break;
        }

        return (
            <div x-label-pos={labelPosition} className={groupCls}>
                {content}
            </div>
        );
    }
}
export default FormInputGroup;