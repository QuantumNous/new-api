import React, { CSSProperties } from 'react';
import BaseComponent from '../_base/baseComponent';
import PropTypes from 'prop-types';
import Portal from '../_portal';
import cls from 'classnames';
import ConfigContext, { ContextValue } from '../configProvider/context';
import { cssClasses, strings } from '@douyinfe/semi-foundation/sideSheet/constants';
import SideSheetContent from './SideSheetContent';
import { noop } from 'lodash';
import SideSheetFoundation, {
    SideSheetAdapter,
    SideSheetProps,
    SideSheetState
} from '@douyinfe/semi-foundation/sideSheet/sideSheetFoundation';
import '@douyinfe/semi-foundation/sideSheet/sideSheet.scss';
import CSSAnimation from "../_cssAnimation";
import { getDefaultPropsFromGlobalConfig, getScrollbarWidth } from '../_utils';

const prefixCls = cssClasses.PREFIX;
const defaultWidthList = strings.WIDTH;
const defaultHeight = strings.HEIGHT;

export type { SideSheetContentProps } from './SideSheetContent';

export interface SideSheetReactProps extends SideSheetProps {
    bodyStyle?: CSSProperties;
    headerStyle?: CSSProperties;
    maskStyle?: CSSProperties;
    style?: CSSProperties;
    title?: React.ReactNode;
    footer?: React.ReactNode;
    children?: React.ReactNode;
    onCancel?: (e: React.MouseEvent | React.KeyboardEvent) => void;
    // innerProps: for Feedback
    canVerticalSetWidth?: boolean

}

export type {
    SideSheetState
};

export default class SideSheet extends BaseComponent<SideSheetReactProps, SideSheetState> {
    static contextType = ConfigContext;
    static propTypes = {
        bodyStyle: PropTypes.object,
        headerStyle: PropTypes.object,
        children: PropTypes.node,
        className: PropTypes.string,
        closable: PropTypes.bool,
        disableScroll: PropTypes.bool,
        getPopupContainer: PropTypes.func,
        height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        mask: PropTypes.bool,
        maskClosable: PropTypes.bool,
        maskStyle: PropTypes.object,
        motion: PropTypes.oneOfType([PropTypes.bool, PropTypes.object, PropTypes.func]),
        onCancel: PropTypes.func,
        placement: PropTypes.oneOf(strings.PLACEMENT),
        size: PropTypes.oneOf(strings.SIZE),
        style: PropTypes.object,
        title: PropTypes.node,
        visible: PropTypes.bool,
        width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        zIndex: PropTypes.number,
        afterVisibleChange: PropTypes.func,
        closeOnEsc: PropTypes.bool,
        footer: PropTypes.node,
        keepDOM: PropTypes.bool,
        'aria-label': PropTypes.string,
    };
    static __SemiComponentName__ = "SideSheet";
    static defaultProps: SideSheetReactProps = getDefaultPropsFromGlobalConfig(SideSheet.__SemiComponentName__, {
        visible: false,
        motion: true,
        mask: true,
        placement: 'right',
        closable: true,
        footer: null,
        zIndex: 1000,
        maskClosable: true,
        size: 'small',
        disableScroll: true,
        closeOnEsc: false,
        afterVisibleChange: noop,
        keepDOM: false
    });
    private _active: boolean;

    constructor(props: SideSheetReactProps) {
        super(props);
        this.state = { displayNone: !this.props.visible };
        this.foundation = new SideSheetFoundation(this.adapter);
        this.bodyOverflow = '';
        this.scrollBarWidth = 0;
        this.originBodyWidth = '100%';
    }

    context: ContextValue;
    private bodyOverflow: string;
    private scrollBarWidth: number;
    private originBodyWidth: string;

    get adapter(): SideSheetAdapter {
        return {
            ...super.adapter,
            disabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                this.bodyOverflow = document.body.style.overflow || '';
                if (!getPopupContainer && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = 'hidden';
                    document.body.style.width = `calc(${this.originBodyWidth || '100%'} - ${this.scrollBarWidth}px)`;
                }
            },
            enabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                if (!getPopupContainer && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = this.bodyOverflow;
                    document.body.style.width = this.originBodyWidth;
                }
            },
            notifyCancel: (e: React.MouseEvent | React.KeyboardEvent) => {
                this.props.onCancel && this.props.onCancel(e);
            },
            notifyVisibleChange: (visible: boolean) => {
                this.props.afterVisibleChange(visible);
            },
            setOnKeyDownListener: () => {
                if (window) {
                    window.addEventListener('keydown', this.handleKeyDown);
                }
            },
            removeKeyDownListener: () => {
                if (window) {
                    window.removeEventListener('keydown', this.handleKeyDown);
                }
            },
            toggleDisplayNone: (displayNone: boolean) => {
                if (displayNone !== this.state.displayNone) {
                    this.setState({ displayNone: displayNone });
                }
            },
        };
    }

    static getDerivedStateFromProps(props: SideSheetReactProps, prevState: SideSheetState) {
        const newState: Partial<SideSheetState> = {};

        if (props.visible && prevState.displayNone) {
            newState.displayNone = false;
        }

        if (!props.visible && !props.motion && !prevState.displayNone) {
            newState.displayNone = true;
        }
        return newState;
    }

    componentDidMount() {
        this.scrollBarWidth = getScrollbarWidth();
        this.originBodyWidth = document.body.style.width;
        if (this.props.visible) {
            this.foundation.beforeShow();
        }
    }

    componentDidUpdate(prevProps: SideSheetReactProps, prevState: SideSheetState, snapshot: any) {
        // hide => show
        if (!prevProps.visible && this.props.visible) {
            this.foundation.beforeShow();
        }
        // show => hide
        if (prevProps.visible && !this.props.visible) {
            this.foundation.afterHide();
        }



        if (prevState.displayNone !== this.state.displayNone) {
            this.foundation.onVisibleChange(!this.state.displayNone);
        }

    }

    componentWillUnmount() {
        if (this.props.visible) {
            this.foundation.destroy();
        }
    }

    handleCancel = (e: React.MouseEvent) => {
        this.foundation.handleCancel(e);
    };

    handleKeyDown = (e: KeyboardEvent) => {
        this.foundation.handleKeyDown(e);
    };

    updateState = () => {
        this.foundation.toggleDisplayNone(!this.props.visible);
    }

    renderContent() {
        const {
            placement,
            className,
            children,
            width,
            height,
            motion,
            visible,
            style,
            maskStyle,
            size,
            zIndex,
            getPopupContainer,
            keepDOM,
            canVerticalSetWidth,
            ...props
        } = this.props;
        let wrapperStyle: CSSProperties = {
            zIndex,
        };
        if (getPopupContainer) {
            wrapperStyle = {
                zIndex,
                position: 'static',
            };
        }
        const { direction } = this.context;
        const isVertical = placement === 'left' || placement === 'right';
        const isHorizontal = placement === 'top' || placement === 'bottom';
        const sheetHeight = isHorizontal ? (height ? height : defaultHeight) : '100%';
        const classList = cls(prefixCls, className, {
            [`${prefixCls}-${placement}`]: placement,
            [`${prefixCls}-popup`]: getPopupContainer,
            [`${prefixCls}-horizontal`]: isHorizontal,
            [`${prefixCls}-rtl`]: direction === 'rtl',
            [`${prefixCls}-hidden`]: keepDOM && this.state.displayNone,
        });
        const contentProps = {
            ...((isVertical || canVerticalSetWidth) ? (width ? { width } : {}) : { width: "100%" }),
            ...props,
            visible,
            motion: false,
            size,
            className: classList,
            height: sheetHeight,
            onClose: this.handleCancel,
        };
        const shouldRender = (this.props.visible || this.props.keepDOM) || (this.props.motion && !this.state.displayNone /* When there is animation, we use displayNone to judge whether animation is ended and judge whether to unmount content */);
        // Since user could change animate duration , we don't know which animation end first. So we call updateState func twice.
        return <CSSAnimation motion={this.props.motion} animationState={visible ? 'enter' : 'leave'} startClassName={
            visible ? `${prefixCls}-animation-mask_show` : `${prefixCls}-animation-mask_hide`
        } onAnimationEnd={this.updateState}>
            {
                ({
                    animationClassName: maskAnimationClassName,
                    animationEventsNeedBind: maskAnimationEventsNeedBind
                }) => {
                    return <CSSAnimation
                        motion={this.props.motion}
                        animationState={visible ? 'enter' : 'leave'}
                        startClassName={visible ? `${prefixCls}-animation-content_show_${this.props.placement}` : `${prefixCls}-animation-content_hide_${this.props.placement}`}
                        onAnimationEnd={this.updateState /* for no mask case*/}
                    >
                        {({ animationClassName, animationStyle, animationEventsNeedBind }) => {
                            return shouldRender ? <Portal getPopupContainer={getPopupContainer} style={wrapperStyle}>
                                <SideSheetContent
                                    {...contentProps}
                                    maskExtraProps={maskAnimationEventsNeedBind}
                                    wrapperExtraProps={animationEventsNeedBind}
                                    dialogClassName={animationClassName}
                                    maskClassName={maskAnimationClassName}
                                    maskStyle={{ ...maskStyle }}
                                    style={{ ...animationStyle, ...style }}>
                                    {children}
                                </SideSheetContent>
                            </Portal> : <></>; 

                        }}
                    </CSSAnimation>;

                }
            }
        </CSSAnimation>;
    }

    render() {
        const {
            zIndex,
            getPopupContainer,
            visible
        } = this.props;

        return this.renderContent();
    }
}

