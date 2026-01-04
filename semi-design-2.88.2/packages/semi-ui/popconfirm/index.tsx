import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { noop, get, isFunction, omit } from 'lodash';
import { cssClasses, numbers } from '@douyinfe/semi-foundation/popconfirm/constants';
import PopconfirmFoundation, { PopconfirmAdapter } from '@douyinfe/semi-foundation/popconfirm/popconfirmFoundation';
import { IconClose, IconAlertTriangle } from '@douyinfe/semi-icons';
import BaseComponent from '../_base/baseComponent';
import Popover, { PopoverProps } from '../popover';
import { Position, Trigger, RenderContentProps } from '../tooltip';
import Button, { ButtonProps } from '../button';
import { Type as ButtonType } from '../button/Button';
import ConfigContext, { ContextValue } from '../configProvider/context';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale as LocaleObject } from '../locale/interface';
import '@douyinfe/semi-foundation/popconfirm/popconfirm.scss';
import { getDefaultPropsFromGlobalConfig } from "../_utils";

export interface PopconfirmProps extends PopoverProps {
    cancelText?: string;
    cancelButtonProps?: ButtonProps;
    cancelType?: ButtonType;
    defaultVisible?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    okText?: string;
    okType?: ButtonType;
    okButtonProps?: ButtonProps;
    motion?: boolean;
    title?: React.ReactNode;
    visible?: boolean;
    prefixCls?: string;
    zIndex?: number;
    trigger?: Trigger;
    showCloseIcon?: boolean;
    position?: Position;
    onCancel?: (e: React.MouseEvent) => Promise<any> | void;
    onConfirm?: (e: React.MouseEvent) => Promise<any> | void;
    onVisibleChange?: (visible: boolean) => void;
    onClickOutSide?: (e: React.MouseEvent) => void
}

export interface PopconfirmState {
    visible: boolean;
    cancelLoading: boolean;
    confirmLoading: boolean
}

interface PopProps {
    [x: string]: any
}

export default class Popconfirm extends BaseComponent<PopconfirmProps, PopconfirmState> {
    static contextType = ConfigContext;
    static propTypes = {
        motion: PropTypes.oneOfType([PropTypes.bool, PropTypes.func, PropTypes.object]),
        disabled: PropTypes.bool,
        content: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        title: PropTypes.any,
        prefixCls: PropTypes.string,
        className: PropTypes.string,
        style: PropTypes.object,
        icon: PropTypes.node,
        okText: PropTypes.string,
        okType: PropTypes.string,
        cancelText: PropTypes.string,
        cancelType: PropTypes.string,
        onCancel: PropTypes.func,
        onConfirm: PropTypes.func,
        onClickOutSide: PropTypes.func,
        onVisibleChange: PropTypes.func,
        visible: PropTypes.bool,
        defaultVisible: PropTypes.bool,
        okButtonProps: PropTypes.object,
        cancelButtonProps: PropTypes.object,
        stopPropagation: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        showCloseIcon: PropTypes.bool,
        zIndex: PropTypes.number,
        // private
        trigger: PropTypes.string,
        position: PropTypes.string,
    };

    static __SemiComponentName__ = "Popconfirm";

    static defaultProps = getDefaultPropsFromGlobalConfig(Popconfirm.__SemiComponentName__, {
        stopPropagation: true,
        trigger: 'click',
        // position: 'bottomLeft',
        onVisibleChange: noop,
        disabled: false,
        icon: <IconAlertTriangle size="extra-large" />,
        okType: 'primary',
        cancelType: 'tertiary',
        prefixCls: cssClasses.PREFIX,
        zIndex: numbers.DEFAULT_Z_INDEX,
        showCloseIcon: true,
        onCancel: noop,
        onConfirm: noop,
        onClickOutSide: noop,
    });

    footerRef: React.RefObject<HTMLDivElement | null>;
    popoverRef: React.RefObject<Popover | null>;
    foundation: PopconfirmFoundation;
    constructor(props: PopconfirmProps) {
        super(props);

        this.state = {
            cancelLoading: false,
            confirmLoading: false,
            visible: props.defaultVisible || false,
        };

        this.foundation = new PopconfirmFoundation(this.adapter);
        this.footerRef = React.createRef();
        this.popoverRef = React.createRef();
    }

    context: ContextValue;

    static getDerivedStateFromProps(props: PopconfirmProps, state: PopconfirmState) {
        const willUpdateStates: Partial<PopconfirmState> = {};
        const { hasOwnProperty } = Object.prototype;

        if (hasOwnProperty.call(props, 'visible')) {
            willUpdateStates.visible = props.visible;
        }

        return willUpdateStates;
    }

    get adapter(): PopconfirmAdapter<PopconfirmProps, PopconfirmState> {
        return {
            ...super.adapter,
            setVisible: (visible: boolean): void => this.setState({ visible }),
            updateConfirmLoading: (loading: boolean): void => this.setState({ confirmLoading: loading }),
            updateCancelLoading: (loading: boolean): void => this.setState({ cancelLoading: loading }),
            notifyConfirm: (e: React.MouseEvent): Promise<any> | void => this.props.onConfirm(e),
            notifyCancel: (e: React.MouseEvent): Promise<any> | void => this.props.onCancel(e),
            notifyVisibleChange: (visible: boolean): void => this.props.onVisibleChange(visible),
            notifyClickOutSide: (e: React.MouseEvent) => this.props.onClickOutSide(e),
            focusCancelButton: () => {
                const buttonNode = this.footerRef?.current?.querySelector('[data-type=cancel]') as HTMLElement;
                buttonNode?.focus({ preventScroll: true });
            },
            focusOkButton: () => {
                const buttonNode = this.footerRef?.current?.querySelector('[data-type=ok]') as HTMLElement;
                buttonNode?.focus({ preventScroll: true });
            },
            focusPrevFocusElement: () => {
                this.popoverRef.current?.focusTrigger();
            }
        };
    }

    handleCancel = (e: React.MouseEvent): void => this.foundation.handleCancel(e && e.nativeEvent);

    handleConfirm = (e: React.MouseEvent): void => this.foundation.handleConfirm(e && e.nativeEvent);

    handleVisibleChange = (visible: boolean): void => this.foundation.handleVisibleChange(visible);

    handleClickOutSide = (e: React.MouseEvent) => this.foundation.handleClickOutSide(e);

    stopImmediatePropagation = (e: React.SyntheticEvent): void => e && e.nativeEvent && e.nativeEvent.stopImmediatePropagation();

    renderControls() {
        const { okText, cancelText, okType, cancelType, cancelButtonProps, okButtonProps } = this.props;
        const { cancelLoading, confirmLoading } = this.state;
        return (
            <LocaleConsumer componentName="Popconfirm">
                {(locale: LocaleObject['Popconfirm'], localeCode: string) => (
                    <>
                        <Button
                            data-type="cancel"
                            type={cancelType}
                            onClick={this.handleCancel}
                            loading={cancelLoading}
                            {...omit(cancelButtonProps, 'autoFocus')}
                        >
                            {cancelText || get(locale, 'cancel')}
                        </Button>
                        <Button
                            data-type="ok"
                            type={okType}
                            theme="solid"
                            onClick={this.handleConfirm}
                            loading={confirmLoading}
                            {...omit(okButtonProps, 'autoFocus')}
                        >
                            {okText || get(locale, 'confirm')}
                        </Button>
                    </>
                )}
            </LocaleConsumer>
        );
    }

    renderConfirmPopCard = ({ initialFocusRef }: { initialFocusRef?: RenderContentProps<any>['initialFocusRef'] }) => {
        const { content, title, className, style, cancelType, icon, prefixCls, showCloseIcon } = this.props;
        const { direction } = this.context;
        const popCardCls = cls(
            prefixCls,
            className,
            {
                [`${prefixCls}-rtl`]: direction === 'rtl',
            }
        );
        const showTitle = title !== null && typeof title !== 'undefined';
        const showContent = !(content === null || typeof content === 'undefined');

        const hasIcon = React.isValidElement(icon);
        const bodyCls = cls({
            [`${prefixCls}-body`]: true,
            [`${prefixCls}-body-withIcon`]: hasIcon
        });

        return (
            /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */
            <div className={popCardCls} onClick={this.stopImmediatePropagation} style={style}>
                <div className={`${prefixCls}-inner`}>
                    <div className={`${prefixCls}-header`}>
                        { hasIcon ? <i className={`${prefixCls}-header-icon`} x-semi-prop="icon">{icon}</i> : null}
                        <div className={`${prefixCls}-header-body`}>
                            {showTitle ? (
                                <div className={`${prefixCls}-header-title`} x-semi-prop="title">
                                    {title}
                                </div>
                            ) : null}
                        </div>
                        {
                            showCloseIcon ? (
                                <Button
                                    className={`${prefixCls}-btn-close`}
                                    icon={<IconClose />}
                                    size="small"
                                    theme={'borderless'}
                                    type={cancelType}
                                    onClick={this.handleCancel}
                                />
                            ) : null
                        }

                    </div>
                    {showContent ? (
                        <div className={bodyCls} x-semi-prop="content">
                            {isFunction(content) ? content({ initialFocusRef }) : content}
                        </div>
                    ) : null}
                    <div className={`${prefixCls}-footer`} ref={this.footerRef}>{this.renderControls()}</div>
                </div>
            </div>
        );
    }

    render() {
        // rtl changes the default position
        const { direction } = this.context;
        const defaultPosition = direction === 'rtl' ? 'bottomRight' : 'bottomLeft';
        const {
            className,
            prefixCls,
            disabled,
            children,
            style,
            position = defaultPosition,
            ...attrs
        } = this.props;

        if (disabled) {
            return children;
        }

        const { visible } = this.state;
        const popProps: PopProps = {
            onVisibleChange: this.handleVisibleChange,
            className: cssClasses.POPOVER,
            onClickOutSide: this.handleClickOutSide,
        };

        if (this.isControlled('visible')) {
            popProps.trigger = 'custom';
        }

        return (
            <Popover
                ref={this.popoverRef}
                {...attrs}
                // A arrow function needs to be passed here, otherwise the content will not be updated after the Popconfirm state is updated
                // Popover is a PureComponent, same props will not trigger update
                content={({ initialFocusRef }) => this.renderConfirmPopCard({ initialFocusRef })}
                visible={visible}
                position={position}
                {...popProps}
            >
                {children}
            </Popover>
        );
    }
}
