import { cssClasses, strings } from '@douyinfe/semi-foundation/modal/constants';
import '@douyinfe/semi-foundation/modal/modal.scss';
import ModalFoundation, { ModalAdapter, ModalProps, ModalState } from '@douyinfe/semi-foundation/modal/modalFoundation';
import cls from 'classnames';
import { noop } from 'lodash';
import PropTypes from 'prop-types';
import React, { CSSProperties, LegacyRef, ReactNode } from 'react';
import BaseComponent from '../_base/baseComponent';
import CSSAnimation from "../_cssAnimation";
import Portal from '../_portal';
import { getDefaultPropsFromGlobalConfig, getScrollbarWidth } from '../_utils';
import Button from '../button';
import { ButtonProps } from '../button/Button';
import { Locale } from '../locale/interface';
import LocaleConsumer from '../locale/localeConsumer';
import ModalContent from './ModalContent';
import confirm, { withConfirm, withError, withInfo, withSuccess, withWarning } from './confirm';
import useModal from './useModal';

export let destroyFns: any[] = [];
export type ConfirmType = 'leftTop' | 'leftBottom' | 'rightTop' | 'rightBottom';
export type Directions = 'ltr' | 'rtl';
export type { ModalState };
export interface ModalReactProps extends ModalProps {
    cancelButtonProps?: ButtonProps;
    children?: React.ReactNode;
    okButtonProps?: ButtonProps;
    bodyStyle?: CSSProperties;
    maskStyle?: CSSProperties;
    style?: CSSProperties;
    icon?: ReactNode;
    closeIcon?: ReactNode;
    title?: ReactNode;
    content?: ReactNode;
    footer?: ReactNode;
    header?: ReactNode;
    onCancel?: (e: React.MouseEvent) => void | Promise<any>;
    onOk?: (e: React.MouseEvent) => void | Promise<any>;
    modalRender?: (node: ReactNode) => ReactNode
}



class Modal extends BaseComponent<ModalReactProps, ModalState> {

    static propTypes = {
        mask: PropTypes.bool,
        closable: PropTypes.bool,
        centered: PropTypes.bool,
        visible: PropTypes.bool,
        width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        confirmLoading: PropTypes.bool,
        cancelLoading: PropTypes.bool,
        okText: PropTypes.string,
        okType: PropTypes.string,
        cancelText: PropTypes.string,
        maskClosable: PropTypes.bool,
        onCancel: PropTypes.func,
        onOk: PropTypes.func,
        modalRender: PropTypes.func,
        afterClose: PropTypes.func,
        okButtonProps: PropTypes.object,
        cancelButtonProps: PropTypes.object,
        style: PropTypes.object,
        className: PropTypes.string,
        maskStyle: PropTypes.object,
        bodyStyle: PropTypes.object,
        zIndex: PropTypes.number,
        title: PropTypes.node,
        icon: PropTypes.node,
        header: PropTypes.node,
        footer: PropTypes.node,
        hasCancel: PropTypes.bool,
        motion: PropTypes.bool,
        children: PropTypes.node,
        getPopupContainer: PropTypes.func,
        getContainerContext: PropTypes.func,
        maskFixed: PropTypes.bool,
        closeIcon: PropTypes.node,
        closeOnEsc: PropTypes.bool,
        size: PropTypes.oneOf(strings.SIZE),
        keepDOM: PropTypes.bool,
        lazyRender: PropTypes.bool,
        direction: PropTypes.oneOf(strings.directions),
        fullScreen: PropTypes.bool,
        footerFill: PropTypes.bool,
    };

    static __SemiComponentName__ = "Modal";

    static defaultProps = getDefaultPropsFromGlobalConfig(Modal.__SemiComponentName__, {
        zIndex: 1000,
        motion: true,
        mask: true,
        centered: false,
        closable: true,
        visible: false,
        okType: 'primary',
        maskClosable: true,
        hasCancel: true,
        onCancel: noop,
        onOk: noop,
        afterClose: noop,
        maskFixed: false,
        closeOnEsc: true,
        size: 'small',
        keepDOM: false,
        lazyRender: true,
        fullScreen: false,
    });
    static useModal = useModal;
    foundation: ModalFoundation;

    private readonly modalRef: LegacyRef<ModalContent>;
    private bodyOverflow: string|null = null;
    private scrollBarWidth: number;
    private originBodyWidth: string;
    private _haveRendered: boolean;

    constructor(props: ModalReactProps) {
        super(props);
        this.state = {
            displayNone: !props.visible,
            isFullScreen: props.fullScreen,
        };
        this.foundation = new ModalFoundation(this.adapter);
        this.modalRef = React.createRef();

        this.scrollBarWidth = 0;
        this.originBodyWidth = '100%';

    }

    get adapter(): ModalAdapter {
        return {
            ...super.adapter,
            getProps: () => this.props,
            disabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                this.bodyOverflow = document.body.style.overflow || '';
                if ((!getPopupContainer || getPopupContainer() === globalThis?.document?.body) && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = 'hidden';
                    document.body.style.width = `calc(${this.originBodyWidth || '100%'} - ${this.scrollBarWidth}px)`;
                }
            },
            enabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                if ((!getPopupContainer || getPopupContainer() === globalThis?.document?.body) && this.bodyOverflow !== null && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = this.bodyOverflow;
                    document.body.style.width = this.originBodyWidth;
                }
            },
            notifyCancel: (e: React.MouseEvent) => {
                return this.props.onCancel(e);
            },
            notifyOk: (e: React.MouseEvent) => {
                return this.props.onOk(e);
            },
            notifyClose: () => {
                this.props.afterClose();
            },
            toggleDisplayNone: (displayNone: boolean, callback?: (hidden: boolean) => void) => {
                if (displayNone !== this.state.displayNone) {
                    this.setState({ displayNone: displayNone }, callback || noop);
                }
            },
            notifyFullScreen: (isFullScreen: boolean) => {
                if (isFullScreen !== this.state.isFullScreen) {
                    this.setState({ isFullScreen });
                }
            },
        };
    }

    static getDerivedStateFromProps(props: ModalReactProps, prevState: ModalState) {
        const newState: Partial<ModalState> = {};

        if (props.fullScreen !== prevState.isFullScreen) {
            newState.isFullScreen = props.fullScreen;
        }


        if (props.visible && prevState.displayNone) {
            newState.displayNone = false;
        }
        //
        // if (!props.visible && !props.motion && !prevState.displayNone) {
        //     newState.displayNone = true;
        // }


        return newState;
    }

    static info = function (props: ModalReactProps) {
        return confirm<ReturnType<typeof withInfo>>(withInfo(props));
    };

    static success = function (props: ModalReactProps) {
        return confirm<ReturnType<typeof withSuccess>>(withSuccess(props));
    };

    static error = function (props: ModalReactProps) {
        return confirm<ReturnType<typeof withError>>(withError(props));
    };

    static warning = function (props: ModalReactProps) {
        return confirm<ReturnType<typeof withWarning>>(withWarning(props));
    };

    static confirm = function (props: ModalReactProps) {
        return confirm<ReturnType<typeof withConfirm>>(withConfirm(props));
    };

    static destroyAll = function destroyAllFn() {
        for (let i = 0, len = destroyFns.length; i < len; i++) {
            const close = destroyFns[i];
            if (close) {
                close();
            }
        }
        destroyFns = [];
    };

    componentDidMount() {

        this.scrollBarWidth = getScrollbarWidth();
        this.originBodyWidth = document.body.style.width;
        if (this.props.visible) {
            this.foundation.beforeShow();
        }
    }

    componentDidUpdate(prevProps: ModalReactProps, prevState: ModalState, snapshot: any) {
        // hide => show
        if (!prevProps.visible && this.props.visible) {
            this.foundation.beforeShow();
        }

        if (!prevState.displayNone && this.state.displayNone) {
            this.foundation.afterHide();
        }
    }

    componentWillUnmount() {
        if (this.props.visible) {
            this.foundation.destroy();
        } else {
            this.foundation.enabledBodyScroll();
        }
    }

    handleCancel = (e: React.MouseEvent) => {
        this.foundation.handleCancel(e);
    };

    handleOk = (e: React.MouseEvent) => {
        this.foundation.handleOk(e);
    };

    updateState = () => {
        const { visible } = this.props;
        this.foundation.toggleDisplayNone(!visible);
    };

    renderFooter = (): ReactNode => {
        const {
            okText,
            okType,
            cancelText,
            confirmLoading,
            cancelLoading,
            hasCancel,
            footerFill,
        } = this.props;
        const getCancelButton = (locale: Locale['Modal']) => {
            if (!hasCancel) {
                return null;
            } else {
                return (
                    <Button
                        aria-label="cancel"
                        onClick={this.handleCancel}
                        loading={cancelLoading === undefined ? this.state.onCancelReturnPromiseStatus === "pending" : cancelLoading}
                        type="tertiary"
                        block={footerFill}
                        autoFocus={true}
                        {...this.props.cancelButtonProps}
                        style={{
                            ...footerFill ? { marginLeft: "unset" } : {},
                            ...this.props.cancelButtonProps?.style
                        }}
                        x-semi-children-alias="cancelText"
                    >
                        {cancelText || locale.cancel}
                    </Button>
                );
            }
        };

        return (
            <LocaleConsumer componentName="Modal">
                {(locale: Locale['Modal'], localeCode: Locale['code']) => (
                    <div className={cls({
                        [`${cssClasses.DIALOG}-footerfill`]: footerFill
                    })}>
                        {getCancelButton(locale)}
                        <Button
                            aria-label="confirm"
                            type={okType}
                            theme="solid"
                            block={footerFill}
                            loading={confirmLoading === undefined ? this.state.onOKReturnPromiseStatus === "pending" : confirmLoading}
                            onClick={this.handleOk}
                            {...this.props.okButtonProps}
                            x-semi-children-alias="okText"
                        >
                            {okText || locale.confirm}
                        </Button>
                    </div>
                )}
            </LocaleConsumer>
        );
    };

    // getDialog = () => {
    //     const {
    //         footer,
    //         ...restProps
    //     } = this.props;
    //     const renderFooter = 'footer' in this.props ? footer : this.renderFooter();
    //     return <ModalContent {...restProps} footer={renderFooter} onClose={this.handleCancel}/>;
    // };

    renderDialog = () => {
        let {
            footer,
            className,
            motion,
            maskStyle: maskStyleFromProps,
            keepDOM,
            style: styleFromProps,
            zIndex,
            getPopupContainer,
            visible,
            modalContentClass,
            ...restProps
        } = this.props;
        let style = styleFromProps;
        const maskStyle = maskStyleFromProps;
        const renderFooter = 'footer' in this.props ? footer : this.renderFooter();
        let wrapperStyle: {
            zIndex?: CSSProperties['zIndex'];
            position?: CSSProperties['position']
        } = {
            zIndex,
        };
        if (getPopupContainer && getPopupContainer() !== globalThis?.document?.body) {
            wrapperStyle = {
                zIndex,
                position: 'static',
            };
        }

        const classList = cls(className, {
            [`${cssClasses.DIALOG}-displayNone`]: keepDOM && this.state.displayNone,
        });

        const shouldRender = this.props.visible || (this.props.keepDOM && (!this.props.lazyRender || this._haveRendered)) || (this.props.motion && !this.state.displayNone /* When there is animation, we use displayNone to judge whether animation is ended and judge whether to unmount content */);

        if (shouldRender) {
            this._haveRendered = true;
        }

        return (
            <CSSAnimation
                motion={this.props.motion}
                animationState={visible ? 'enter' : 'leave'}
                startClassName={visible ? `${cssClasses.DIALOG}-content-animate-show` : `${cssClasses.DIALOG}-content-animate-hide`}
                onAnimationEnd={() => {
                    this.updateState();
                }}
            >
                {
                    ({ animationClassName, animationEventsNeedBind }) => {
                        return <CSSAnimation motion={this.props.motion} animationState={visible ? 'enter' : 'leave'}
                            startClassName={visible ? `${cssClasses.DIALOG}-mask-animate-show` : `${cssClasses.DIALOG}-mask-animate-hide`}
                            onAnimationEnd={() => {
                                this.updateState();
                            }}
                        >
                            {
                                ({ animationClassName: maskAnimationClassName, animationEventsNeedBind: maskAnimationEventsNeedBind }) => {
                                    return shouldRender ? <Portal style={wrapperStyle} getPopupContainer={getPopupContainer}> <ModalContent
                                        {...restProps}
                                        contentExtraProps={animationEventsNeedBind}
                                        maskExtraProps={maskAnimationEventsNeedBind}
                                        isFullScreen={this.state.isFullScreen}
                                        contentClassName={`${animationClassName} ${modalContentClass}`}
                                        maskClassName={maskAnimationClassName}
                                        className={classList}
                                        getPopupContainer={getPopupContainer}
                                        maskStyle={maskStyle}
                                        style={style}
                                        ref={this.modalRef}
                                        footer={renderFooter}
                                        onClose={this.handleCancel}

                                    /></Portal> : <></>;
                                }
                            }
                        </CSSAnimation>;
                    }
                }
            </CSSAnimation>
        );
    };

    render() {
        const {
            visible,
            keepDOM,
            lazyRender,
        } = this.props;
        return this.renderDialog();
    }


}


export default Modal;
