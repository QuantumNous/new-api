import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import FormFoundation, { BaseFormAdapter } from '@douyinfe/semi-foundation/form/foundation';
import { strings, cssClasses } from '@douyinfe/semi-foundation/form/constants';
import { getUuidv4 } from '@douyinfe/semi-foundation/utils/uuid';
import warning from '@douyinfe/semi-foundation/utils/warning';
import BaseComponent from '../_base/baseComponent';
import { FormStateContext, FormApiContext, FormUpdaterContext } from './context';
import { isEmptyChildren } from '../_base/reactUtils';
import Row from '../grid/row';
import { cloneDeep } from '../_utils/index';
import Slot from './slot';
import Section from './section';
import Label from './label';
import ErrorMessage, { ReactFieldError } from './errorMessage';
import FormInputGroup from './group';
import { noop } from 'lodash';
import '@douyinfe/semi-foundation/form/form.scss';
import {
    FormInput,
    FormInputNumber,
    FormTextArea,
    FormSelect,
    FormCheckboxGroup,
    FormCheckbox,
    FormRadioGroup,
    FormRadio,
    FormDatePicker,
    FormSwitch,
    FormSlider,
    FormTimePicker,
    FormTreeSelect,
    FormCascader,
    FormRating,
    FormAutoComplete,
    FormUpload,
    FormTagInput } from './field';
import {
    BaseFormProps,
    FormState,
    FormApi,
    ErrorMsg
} from './interface';
const prefix = cssClasses.PREFIX;

interface BaseFormState {
    formId: string
}
class Form<Values extends Record<string, any> = any> extends BaseComponent<BaseFormProps<Values>, BaseFormState> {
    static propTypes = {
        'aria-label': PropTypes.string,
        onSubmit: PropTypes.func,
        onSubmitFail: PropTypes.func,
        /* Triggered from update, including field mount/unmount/value change/blur/verification status change/error prompt change, input parameter is formState, currentField */
        onChange: PropTypes.func,
        onReset: PropTypes.func,
        // Triggered when the value of the form is updated, only when the value of the subfield changes. The entry parameter is formState.values
        onValueChange: PropTypes.func,
        autoScrollToError: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
        allowEmpty: PropTypes.bool,
        className: PropTypes.string,
        component: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        disabled: PropTypes.bool,
        extraTextPosition: PropTypes.oneOf(strings.EXTRA_POS),
        getFormApi: PropTypes.func,
        initValues: PropTypes.object,
        validateFields: PropTypes.func,
        layout: PropTypes.oneOf(strings.LAYOUT),
        labelPosition: PropTypes.oneOf(strings.LABEL_POS),
        labelWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        labelAlign: PropTypes.oneOf(strings.LABEL_ALIGN),
        labelCol: PropTypes.object, // Control labelCol {span: number, offset: number} for all field child nodes
        render: PropTypes.func,
        style: PropTypes.object,
        showValidateIcon: PropTypes.bool,
        stopValidateWithError: PropTypes.bool,
        stopPropagation: PropTypes.shape({
            submit: PropTypes.bool,
            reset: PropTypes.bool,
        }),
        id: PropTypes.string,
        wrapperCol: PropTypes.object, // Control wrapperCol {span: number, offset: number} for all field child nodes
        trigger: PropTypes.oneOfType([
            PropTypes.oneOf(['blur', 'change', 'custom', 'mount']),
            PropTypes.arrayOf(PropTypes.oneOf(['blur', 'change', 'custom', 'mount'])),
        ])
    };

    static defaultProps = {
        onChange: noop,
        onSubmitFail: noop,
        onSubmit: noop,
        onReset: noop,
        onValueChange: noop,
        onErrorChange: noop,
        layout: 'vertical',
        labelPosition: 'top',
        allowEmpty: false,
        autoScrollToError: false,
        showValidateIcon: true,
    };

    static Input = FormInput;
    static TextArea = FormTextArea;
    static InputNumber = FormInputNumber;
    static Select = FormSelect;
    static Checkbox = FormCheckbox;
    static CheckboxGroup = FormCheckboxGroup;
    static Radio = FormRadio;
    static RadioGroup = FormRadioGroup;
    static DatePicker = FormDatePicker;
    static TimePicker = FormTimePicker;
    static Switch = FormSwitch;
    static Slider = FormSlider;
    static TreeSelect = FormTreeSelect;
    static Cascader = FormCascader;
    static Rating = FormRating;
    static AutoComplete = FormAutoComplete;
    static Upload = FormUpload;
    static TagInput = FormTagInput;

    static Slot = Slot;
    static ErrorMessage = ErrorMessage;
    static InputGroup = FormInputGroup;
    static Label = Label;
    static Section = Section;

    formApi: FormApi<Values>;

    constructor(props: BaseFormProps<Values>) {
        super(props);
        this.state = {
            formId: '',
        };
        warning(
            Boolean(props.component && props.render),
            '[Semi Form] You should not use <Form component> and <Form render> in ths same time; <Form render> will be ignored'
        );
        warning(
            props.component && props.children && !isEmptyChildren(props.children),
            '[Semi Form] You should not use <Form component> and <Form>{children}</Form> in ths same time; <Form>{children}</Form> will be ignored'
        );
        warning(
            props.render && props.children && !isEmptyChildren(props.children),
            '[Semi Form] You should not use <Form render> and <Form>{children}</Form> in ths same time; <Form>{children}</Form> will be ignored'
        );
        this.submit = this.submit.bind(this);
        this.reset = this.reset.bind(this);
        this.foundation = new FormFoundation(this.adapter);
        this.formApi = this.foundation.getFormApi();
        if (this.props.getFormApi) {
            this.props.getFormApi(this.formApi);
        }
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    get adapter(): BaseFormAdapter<BaseFormProps<Values>, BaseFormState, Values> {
        return {
            ...super.adapter,
            cloneDeep,
            notifySubmit: (values: Values, e: any) => {
                this.props.onSubmit(values, e);
            },
            notifySubmitFail: (errors, values, e: any) => {
                this.props.onSubmitFail(errors, values, e);
            },
            forceUpdate: (callback?: () => void) => {
                this.forceUpdate(callback);
            },
            notifyChange: (formState: FormState) => {
                this.props.onChange(formState);
            },
            notifyValueChange: (values: Values, changedValues: Partial<Values>) => {
                this.props.onValueChange(values, changedValues);
            },
            notifyErrorChange: (errors: Record<keyof Values, ReactFieldError>, changedError: Partial<Record<keyof Values, ReactFieldError>>) => {
                this.props.onErrorChange(errors, changedError);
            },
            notifyReset: () => {
                this.props.onReset();
            },
            initFormId: () => {
                this.setState({
                    formId: getUuidv4()
                });
            },
            getInitValues: () => this.props.initValues,
            getFormProps: (keys: undefined | string | Array<string>) => {
                if (typeof keys === 'undefined') {
                    return this.props;
                } else if (typeof keys === 'string') {
                    return this.props[keys];
                } else {
                    const props = {};
                    keys.forEach(key => {
                        props[key] = this.props[key];
                    });
                    return props;
                }
            },
            getAllErrorDOM: () => {
                const { formId } = this.state;
                const { id } = this.props;
                const xId = id ? id : formId;
                return document.querySelectorAll(
                    `form[x-form-id="${xId}"] .${cssClasses.PREFIX}-field-error-message`
                );
            },
            getFieldDOM: (field: string) => {
                const { formId } = this.state;
                const { id } = this.props;
                const xId = id ? id : formId;
                return document.querySelector(`form[x-form-id="${xId}"] .${cssClasses.PREFIX}-field[x-field-id="${field}"]`);
            },
            getFieldErrorDOM: (field: string) => {
                const { formId } = this.state;
                const { id } = this.props;
                const xId = id ? id : formId;
                let selector = `form[x-form-id="${xId}"] .${cssClasses.PREFIX}-field[x-field-id="${field}"] .${cssClasses.PREFIX}-field-error-message`;
                return document.querySelector(selector);
            }
        };
    }

    get content() {
        const { children, component, render } = this.props;
        const formState = this.foundation.getFormState();
        const props = {
            formState,
            formApi: this.foundation.getFormApi(),
            values: formState.values,
        };
        if (component) {
            return React.createElement(component, props);
        }
        if (render) {
            return render(props);
        }
        if (typeof children === 'function') {
            return children(props);
        }
        return children;
    }

    submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (this.props.stopPropagation && this.props.stopPropagation.submit) {
            e.stopPropagation();
        }
        this.foundation.submit(e);
    }

    reset(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (this.props.stopPropagation && this.props.stopPropagation.reset) {
            e.stopPropagation();
        }
        this.foundation.reset();
    }

    render() {
        const needClone = false;
        const formState = this.foundation.getFormState(needClone);
        const updaterApi = this.foundation.getModifyFormStateApi();
        const { formId } = this.state;
        const {
            children,
            getFormApi,
            onChange,
            onSubmit,
            onSubmitFail,
            onErrorChange,
            onValueChange,
            component,
            render,
            validateFields,
            initValues,
            layout,
            style,
            className,
            labelPosition,
            labelWidth,
            labelAlign,
            labelCol,
            wrapperCol,
            allowEmpty,
            autoScrollToError,
            showValidateIcon,
            stopValidateWithError,
            extraTextPosition,
            id,
            trigger,
            ...rest
        } = this.props;

        const formCls = classNames(prefix, className, {
            [prefix + '-vertical']: layout === 'vertical',
            [prefix + '-horizontal']: layout === 'horizontal',
        });
        const shouldAppendRow = wrapperCol && labelCol;

        const formContent = (
            <form
                style={style}
                {...rest}
                onReset={this.reset}
                onSubmit={this.submit}
                className={formCls}
                id={id ? id : formId}
                x-form-id={id ? id : formId}
            >
                {this.content}
            </form>
        );
        const withRowForm = <Row>{formContent}</Row>;
        return (
            <FormUpdaterContext.Provider value={updaterApi}>
                <FormApiContext.Provider value={this.formApi}>
                    <FormStateContext.Provider value={formState}>
                        {shouldAppendRow ? withRowForm : formContent}
                    </FormStateContext.Provider>
                </FormApiContext.Provider>
            </FormUpdaterContext.Provider>
        );
    }
}

export default Form;
