import React, { CSSProperties, ReactNode } from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/modal/constants';
import ConfigContext, { ContextValue } from '../configProvider/context';
import Button from '../iconButton';
import Typography from '../typography';
import BaseComponent from '../_base/baseComponent';
import ModalContentFoundation, {
    ModalContentAdapter,
    ModalContentProps,
    ModalContentState
} from '@douyinfe/semi-foundation/modal/modalContentFoundation';
import { get, isFunction, noop } from 'lodash';
import { IconClose } from '@douyinfe/semi-icons';
import FocusTrapHandle from "@douyinfe/semi-foundation/utils/FocusHandle";

let uuid = 0;


export interface ModalContentReactProps extends ModalContentProps {
    children?: React.ReactNode;
    modalRender?: (node: ReactNode) => ReactNode
}

export default class ModalContent extends BaseComponent<ModalContentReactProps, ModalContentState> {
    static contextType = ConfigContext;
    static propTypes = {
        close: PropTypes.func,
        getContainerContext: PropTypes.func,
        contentClassName: PropTypes.string,
        maskClassName: PropTypes.string,
        onAnimationEnd: PropTypes.func,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        close: noop,
        getContainerContext: noop,
        contentClassName: '',
        maskClassName: ''
    };
    dialogId: string;
    private timeoutId: NodeJS.Timeout;

    modalDialogRef: React.MutableRefObject<HTMLDivElement>;
    foundation: ModalContentFoundation;
    context: ContextValue;
    focusTrapHandle: FocusTrapHandle;

    constructor(props: ModalContentProps) {
        super(props);
        this.state = {
            dialogMouseDown: false,
            prevFocusElement: FocusTrapHandle.getActiveElement(),
        };
        this.foundation = new ModalContentFoundation(this.adapter);
        this.dialogId = `dialog-${uuid++}`;
        this.modalDialogRef = React.createRef();
    }

    get adapter(): ModalContentAdapter {
        return {
            ...super.adapter,
            notifyClose: (e: React.MouseEvent) => {
                this.props.onClose(e);
            },
            notifyDialogMouseDown: () => {
                this.setState({ dialogMouseDown: true });
            },
            notifyDialogMouseUp: () => {
                if (this.state.dialogMouseDown) {
                    // Not setting setTimeout triggers close when modal external mouseUp
                    this.timeoutId = setTimeout(() => {
                        this.setState({ dialogMouseDown: false });
                    }, 0);
                }
            },
            addKeyDownEventListener: () => {
                if (this.props.closeOnEsc) {
                    document.addEventListener('keydown', this.foundation.handleKeyDown);
                }
            },
            removeKeyDownEventListener: () => {
                if (this.props.closeOnEsc) {
                    document.removeEventListener('keydown', this.foundation.handleKeyDown);
                }
            },
            getMouseState: () => this.state.dialogMouseDown,
            modalDialogFocus: () => {
                const { preventScroll } = this.props;
                let activeElementInDialog;
                if (this.modalDialogRef) {
                    const activeElement = FocusTrapHandle.getActiveElement();
                    activeElementInDialog = this.modalDialogRef.current.contains(activeElement);
                    this.focusTrapHandle?.destroy();
                    this.focusTrapHandle = new FocusTrapHandle(this.modalDialogRef.current, { preventScroll });
                }
                if (!activeElementInDialog) {
                    this.modalDialogRef?.current?.focus({ preventScroll });
                }
            },
            modalDialogBlur: () => {
                this.modalDialogRef?.current.blur();
                this.focusTrapHandle?.destroy();
            },
            prevFocusElementReFocus: () => {
                const { prevFocusElement } = this.state;
                const { preventScroll } = this.props;
                const focus = get(prevFocusElement, 'focus');
                isFunction(focus) && prevFocusElement.focus({ preventScroll });
            }
        };
    }

    componentDidMount() {
        this.foundation.handleKeyDownEventListenerMount();
        this.foundation.modalDialogFocus();
        const nodes = FocusTrapHandle.getFocusableElements(this.modalDialogRef.current);
        if (!this.modalDialogRef.current.contains(document.activeElement)) {
            // focus on first focusable element
            nodes[0]?.focus();
        }
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
        this.foundation.destroy();
    }

    onKeyDown = (e: React.MouseEvent) => {
        this.foundation.handleKeyDown(e);
    };

    // Record when clicking the modal box
    onDialogMouseDown = () => {
        this.foundation.handleDialogMouseDown();
    };

    // Cancel recording when clicking the modal box at the end
    onMaskMouseUp = () => {
        this.foundation.handleMaskMouseUp();
    };

    // onMaskClick will judge dialogMouseDown before onMaskMouseUp updates dialogMouseDown
    onMaskClick = (e: React.MouseEvent) => {
        this.foundation.handleMaskClick(e);
    };

    close = (e: React.MouseEvent) => {
        this.foundation.close(e);
    };

    getMaskElement = () => {
        const { ...props } = this.props;
        const { mask, maskClassName } = props;
        if (mask) {
            const className = cls(`${cssClasses.DIALOG}-mask`, {
                // [`${cssClasses.DIALOG}-mask-hidden`]: !props.visible,
            });
            return <div key="mask" {...this.props.maskExtraProps} className={cls(className, maskClassName)} style={props.maskStyle}/>;
        }
        return null;
    };

    renderCloseBtn = () => {
        const {
            closable,
            closeIcon,
        } = this.props;
        let closer;
        if (closable) {
            const iconType = closeIcon || <IconClose x-semi-prop="closeIcon"/>;
            closer = (
                <Button
                    aria-label="close"
                    className={`${cssClasses.DIALOG}-close`}
                    key="close-btn"
                    onClick={this.close}
                    type="tertiary"
                    icon={iconType}
                    theme="borderless"
                    size="small"
                />
            );
        }
        return closer;
    };

    renderIcon = () => {
        const { icon } = this.props;
        return icon ? <span className={`${cssClasses.DIALOG}-icon-wrapper`} x-semi-prop="icon">{icon}</span> : null;
    };

    renderHeader = () => {
        if ('header' in this.props) {
            return this.props.header;
        }
        const { title } = this.props;
        const closer = this.renderCloseBtn();
        const icon = this.renderIcon();
        return (title === null || title === undefined) ?
            null :
            (
                <div className={`${cssClasses.DIALOG}-header`}>
                    {icon}
                    <Typography.Title
                        heading={5}
                        className={`${cssClasses.DIALOG}-title`}
                        id={`${cssClasses.DIALOG}-title`}
                        x-semi-prop="title"
                    >
                        {title}
                    </Typography.Title>
                    {closer}
                </div>
            );
    };

    renderBody = () => {
        const {
            bodyStyle,
            children,
            title,
        } = this.props;
        const bodyCls = cls(`${cssClasses.DIALOG}-body`, {
            [`${cssClasses.DIALOG}-withIcon`]: this.props.icon,
        });
        const closer = this.renderCloseBtn();
        const icon = this.renderIcon();
        const hasHeader = title !== null && title !== undefined || 'header' in this.props;
        return hasHeader ? (
            <div className={bodyCls} id={`${cssClasses.DIALOG}-body`} style={bodyStyle} x-semi-prop="children">
                {children}
            </div>
        ) : (
            <div className={`${cssClasses.DIALOG}-body-wrapper`}>
                {icon}
                <div className={bodyCls} style={bodyStyle} x-semi-prop="children">
                    {children}
                </div>
                {closer}
            </div>
        );
    };

    getDialogElement = () => {
        const { ...props } = this.props;
        const style: CSSProperties = {};
        const digCls = cls(`${cssClasses.DIALOG}`, {
            [`${cssClasses.DIALOG}-centered`]: props.centered,
            [`${cssClasses.DIALOG}-${props.size}`]: props.size,
        });
        if (props.width) {
            style.width = props.width;
        }
        if (props.height) {
            style.height = props.height;
        }
        if (props.isFullScreen) {
            style.width = '100%';
            style.height = '100%';
            style.margin = 'unset';
        }
        const body = this.renderBody();
        const header = this.renderHeader();
        const footer = props.footer ? (
            <div className={`${cssClasses.DIALOG}-footer`} x-semi-prop="footer">
                {props.footer}
            </div>
        ) : null;

        const modalContentElement = (<div
            role="dialog"
            ref={this.modalDialogRef}
            aria-modal="true"
            aria-labelledby={`${cssClasses.DIALOG}-title`}
            aria-describedby={`${cssClasses.DIALOG}-body`}
            onAnimationEnd={props.onAnimationEnd}
            className={cls([`${cssClasses.DIALOG}-content`,
                props.contentClassName,
                {
                    [`${cssClasses.DIALOG}-content-fullScreen`]: props.isFullScreen,
                    [`${cssClasses.DIALOG}-content-height-set`]: props.height || get(props.style, 'height')
                }])}>
            {header}
            {body}
            {footer}
        </div>);
        const dialogElement = (
            <div
                key="dialog-element"
                className={digCls}
                onMouseDown={this.onDialogMouseDown}
                style={{ ...props.style, ...style }}
                id={this.dialogId}
            >
                {props?.modalRender ? props?.modalRender(modalContentElement) : modalContentElement}
            </div>
        );
        return dialogElement;
    };

    render() {
        const {
            maskClosable,
            className,
            getPopupContainer,
            maskFixed,
            getContainerContext,
            ...rest
        } = this.props;
        const { direction } = this.context;
        const classList = cls(className, {
            [`${cssClasses.DIALOG}-popup`]: getPopupContainer && getPopupContainer() !== globalThis?.document?.body && !maskFixed,
            [`${cssClasses.DIALOG}-fixed`]: maskFixed,
            [`${cssClasses.DIALOG}-rtl`]: direction === 'rtl',
        });

        const containerContext = getContainerContext();
        const dataAttr = this.getDataAttr(rest);

        const elem = (
            <div className={classList} {...dataAttr}>
                {this.getMaskElement()}
                <div
                    role="none"
                    className={cls({
                        [`${cssClasses.DIALOG}-wrap`]: true,
                        [`${cssClasses.DIALOG}-wrap-center`]: this.props.centered
                    })}
                    onClick={maskClosable ? this.onMaskClick : null}
                    onMouseUp={maskClosable ? this.onMaskMouseUp : null}
                    {...this.props.contentExtraProps}
                >
                    {this.getDialogElement()}
                </div>
            </div>
        );

        return containerContext && containerContext.Provider ?
            <containerContext.Provider value={containerContext.value}>{elem}</containerContext.Provider> : elem;
    }
}
