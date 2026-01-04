/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import cls from 'classnames';
import { cssClasses, strings } from '@douyinfe/semi-foundation/feedback/constants';
import BaseComponent from '../_base/baseComponent';
import { ArrayElement } from '../_base/base';
import { TextArea, RadioGroup, CheckboxGroup, Button, Modal, SideSheet } from '..';
import { RadioGroupProps } from '../radio/radioGroup';
import { CheckboxGroupProps } from '../checkbox/checkboxGroup';
import { omit, noop } from 'lodash';
import { ModalReactProps } from '../modal';
import { SideSheetReactProps } from '../sideSheet';
import { TextAreaProps } from '../input/textarea';
import { Locale } from '../locale/interface';
import LocaleConsumer from '../locale/localeConsumer';
import { ButtonProps } from '../button';
import FeedbackFoundation, { FeedbackAdapter } from '@douyinfe/semi-foundation/feedback/foundation';
import { RadioChangeEvent } from '../radio';
import '@douyinfe/semi-foundation/feedback/feedback.scss';

const { Emoji } = strings;

const prefixCls = cssClasses.PREFIX;

export interface BasicFeedbackProps {
    mode?: ArrayElement<typeof strings.MODE>;
    type?: ArrayElement<typeof strings.TYPE>;
    onValueChange?: (value: FeedbackValue) => void; 
    textAreaProps?: TextAreaProps;
    radioGroupProps?: RadioGroupProps;
    checkboxGroupProps?: CheckboxGroupProps;
    renderContent?: (content: React.ReactNode) => React.ReactNode
}

export interface FeedbackModalProps extends ModalReactProps, BasicFeedbackProps {
}

export interface FeedbackSideSheetProps extends Omit<SideSheetReactProps, 'onCancel'>, BasicFeedbackProps {
    onOk?: (e: React.MouseEvent) => void | Promise<any>;
    onCancel?: (e: React.MouseEvent) => void | Promise<any>;
    okButtonProps?: ButtonProps;
    cancelButtonProps?: ButtonProps;
    afterClose?: () => void
}

export type FeedbackProps = FeedbackModalProps | FeedbackSideSheetProps;

interface EmojiResult {
    emoji?: string;
    text?: string
}

type FeedbackValue = string | string[] | EmojiResult;

interface FeedbackState {
    value: FeedbackValue;
    onOKReturnPromiseStatus?: "pending" | "fulfilled" | "rejected";
    onCancelReturnPromiseStatus?: "pending" | "fulfilled" | "rejected"
}

export default class Feedback extends BaseComponent<FeedbackProps, FeedbackState> {
    static __SemiComponentName__ = "Feedback";

    static defaultProps = {
        mode: 'popup',
        type: 'emoji',
        onValueChange: noop,
        onCancel: noop,
        onOk: noop,
        afterClose: noop,
    };

    foundation: FeedbackFoundation;

    constructor(props: FeedbackProps) {
        super(props);
        this.state = {
            value: null,
            onOKReturnPromiseStatus: "fulfilled",
            onCancelReturnPromiseStatus: "fulfilled",
        };
        this.foundation = new FeedbackFoundation(this.adapter);
    }

    get adapter() {
        return {
            ...super.adapter,
            setValue: (value: FeedbackValue) => {
                this.setState({ value: value });
            },
            notifyValueChange: (value: FeedbackValue) => {
                this.setState({ value: value });
                this.props.onValueChange(value);
            },
            notifyClose: () => {
                return this.props.afterClose();
            },
            notifyCancel: (e: React.MouseEvent) => {
                return this.props.onCancel(e);
            },
            notifyOk: (e: React.MouseEvent) => {
                return this.props.onOk(e);
            },
            notifyTextAreaChange: (value: string, e: React.MouseEvent<HTMLTextAreaElement>) => {
                const { textAreaProps = {} } = this.props;
                const { onChange } = textAreaProps;
                onChange?.(value, e);
            },
            notifyCheckBoxChange: (value: any[]) => {
                const { checkboxGroupProps = {} } = this.props;
                const { onChange } = checkboxGroupProps;
                onChange?.(value);
            },
            notifyRadioChange: (e: RadioChangeEvent) => {
                const { onChange } = this.props?.radioGroupProps;
                onChange?.(e);
            }
        };
    }

    textNode = () => {
        const { textAreaProps } = this.props;
        return <TextArea
            onChange={this.foundation.handleTextChange}
            placeholder='Provider additional feedback'
            {...textAreaProps}
        />;
    }

    emojiNode = () => {
        const { value } = this.state;
        const { textAreaProps } = this.props;
        const { emoji } = (value ?? {}) as EmojiResult;
        return <>
            <div className={`${prefixCls}-emoji-container`}>
                {Object.values(Emoji).map(item => (
                    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                    <span
                        key={item} 
                        className={cls(`${prefixCls}-emoji-item`, { [`${prefixCls}-emoji-item-selected`]: item === emoji })}
                        data-value={item} 
                        onClick={this.foundation.handleEmojiClick}
                    >{item}</span>
                ))}
            </div>
            {emoji === Emoji.bad && <TextArea
                onChange={this.foundation.handleEmojiReasonChange}
                placeholder='Provider additional feedback(optional)'
                {...textAreaProps}
            />}
        </>;
    }

    radioNode = () => {
        const { radioGroupProps } = this.props;
        return <div className={`${prefixCls}-radio-container`}>
            <RadioGroup
                direction='vertical'
                onChange={this.foundation.handleRadioChange}
                {...omit(radioGroupProps, 'onChange')}
            />
        </div>;
    }

    checkboxNode = () => {
        const { checkboxGroupProps } = this.props;
        return <div className={`${prefixCls}-checkbox-container`}>
            <CheckboxGroup 
                direction='vertical'
                onChange={this.foundation.handleCheckboxChange}
                {...omit(checkboxGroupProps, 'onChange')}
            />
        </div>;
    }
    
    getRealChildren = () => {
        const { type, renderContent, children } = this.props;
        let result = null;
        switch (type) {
            case 'custom':
                result = children;
                break;
            case 'text': 
                result = this.textNode();
                break;
            case 'emoji':
                result = this.emojiNode();
                break;
            case 'radio':
                result = this.radioNode();
                break;
            case 'checkbox':
                result = this.checkboxNode();
                break;
            default:
                break;
        }
        
        if (typeof renderContent === 'function') {
            result = renderContent(result);
        }
        return result;
    }

    renderFooter = (locale: Locale['Feedback']) => {
        const { footer, cancelButtonProps, okButtonProps } = this.props;
        const { onCancelReturnPromiseStatus, onOKReturnPromiseStatus } = this.state;
        if (footer) {
            return footer;
        } else {
            return <div className={`${prefixCls}-footer`}>
                <Button 
                    type='primary' 
                    onClick={this.foundation.handleCancel}
                    loading={onCancelReturnPromiseStatus === "pending"}
                    {...cancelButtonProps}
                >{locale.cancel}</Button>
                <Button 
                    type='primary' 
                    theme='solid' 
                    disabled={this.disableSubmitButton()} 
                    onClick={this.foundation.handleSubmit} 
                    loading={onOKReturnPromiseStatus === "pending"}
                    {...okButtonProps}
                >{locale.submit}</Button>
            </div>;
        }
    }

    disableSubmitButton = () => {
        const { value } = this.state;
        return !Boolean(value) || (Array.isArray(value) && value.length === 0);
    }

    render(): JSX.Element {
        const { className, children, type, mode, ...rest } = this.props;
        const restProps = this.foundation.getRestProps();
        const realChildren = this.getRealChildren();
        const disabledOkButton = this.disableSubmitButton();
        const realCls = cls(prefixCls, {
            [`${prefixCls}-${type}`]: type,
            className: className
        });

        return (<LocaleConsumer componentName="Feedback">
            {(locale: Locale['Feedback'], localeCode: Locale['code']) => {
                return (mode === 'modal' ? (<Modal
                    okButtonProps={{ disabled: disabledOkButton }}
                    okText={locale.submit}
                    cancelText={locale.cancel}
                    className={realCls}
                    {...restProps}
                    onOk={this.foundation.handleModalOk}
                    onCancel={this.foundation.handleModalCancel}
                >
                    {realChildren}
                </Modal>) : (<SideSheet
                    mask={false}
                    disableScroll={false}
                    canVerticalSetWidth={true}
                    placement="bottom"
                    height="auto"
                    className={realCls}
                    footer={this.renderFooter(locale)}
                    onCancel={this.foundation.handleCancel}
                    {...(restProps as SideSheetReactProps)}
                >
                    {realChildren}
                </SideSheet>)
                );
            }}
        </LocaleConsumer>);
    }
}
