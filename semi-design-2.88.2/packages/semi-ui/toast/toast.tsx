import React, { CSSProperties } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import ConfigContext, { ContextValue } from '../configProvider/context';
import ToastFoundation, { ToastAdapter, ToastState, ToastProps } from '@douyinfe/semi-foundation/toast/toastFoundation';
import { numbers, cssClasses, strings } from '@douyinfe/semi-foundation/toast/constants';
import BaseComponent from '../_base/baseComponent';
import Button from '../iconButton/index';
import { IconClose, IconAlertTriangle, IconInfoCircle, IconTickCircle, IconAlertCircle } from '@douyinfe/semi-icons';
import { noop } from 'lodash';
import { getDefaultPropsFromGlobalConfig, isSemiIcon } from '../_utils';

const prefixCls = cssClasses.PREFIX;

export interface ToastReactProps extends ToastProps {
    style?: CSSProperties;
    icon?: React.ReactNode;
    content: React.ReactNode;
    stack?: boolean;
    stackExpanded?: boolean;
    onAnimationEnd?: (e: React.AnimationEvent) => void;
    onAnimationStart?: (e: React.AnimationEvent) => void;
    positionInList?: {
        index: number;
        length: number
    }
}

class Toast extends BaseComponent<ToastReactProps, ToastState> {

    toastEle: React.RefObject<HTMLDivElement> = React.createRef();
    static contextType = ConfigContext;
    static propTypes = {
        onClose: PropTypes.func,
        content: PropTypes.node,
        close: PropTypes.func,
        duration: PropTypes.number,
        theme: PropTypes.oneOf(strings.themes),
        type: PropTypes.oneOf(strings.types),
        textMaxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        style: PropTypes.object,
        className: PropTypes.string,
        showClose: PropTypes.bool,
        stack: PropTypes.bool,
        stackExpanded: PropTypes.bool,
        icon: PropTypes.node,
        direction: PropTypes.oneOf(strings.directions),
    };
    static __SemiComponentName__ = "Toast";
    static defaultProps = getDefaultPropsFromGlobalConfig(Toast.__SemiComponentName__, {
        onClose: noop,
        content: '',
        close: noop,
        duration: numbers.duration,
        textMaxWidth: 450,
        showClose: true,
        stack: false,
        stackExpanded: false,
        theme: 'normal'
    })

    constructor(props: ToastReactProps) {
        super(props);
        this.state = {};
        this.foundation = new ToastFoundation(this.adapter);
    }

    context: ContextValue;

    get adapter(): ToastAdapter {
        return {
            ...super.adapter,
            notifyWrapperToRemove: (id: string) => {
                this.props.close(id);
            },
            notifyClose: () => {
                this.props.onClose();
            },
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    close(e: React.MouseEvent) {
        this.foundation.close(e);
    }

    clearCloseTimer = () => {
        this.foundation.clearCloseTimer_();
    };

    startCloseTimer = () => {
        this.foundation.startCloseTimer_();
    };

    restartCloseTimer = () => {
        this.foundation.restartCloseTimer();
    }

    renderIcon() {
        const { type, icon } = this.props;
        const iconMap = {
            warning: <IconAlertTriangle />,
            success: <IconTickCircle />,
            info: <IconInfoCircle />,
            error: <IconAlertCircle />
        };
        const iconType = iconMap[type];
        const iconSize = 'large';
        const iconCls = cls(`${prefixCls}-icon`, `${prefixCls}-icon-${type}`);
        if (icon) {
            return isSemiIcon(icon) ? React.cloneElement((icon as React.ReactElement<any>), { size: iconSize, className: `${prefixCls}-icon` }) : icon;
        }
        if (type && iconType) {
            return React.cloneElement(iconType, { size: iconSize, className: iconCls });
        }
        return null;
    }

    render() {
        const { content, type, theme, showClose, textMaxWidth, className, style } = this.props;
        const direction = this.props.direction || this.context.direction;
        const toastCls = cls(prefixCls, className, {
            [`${prefixCls}-${type}`]: true,
            [`${prefixCls}-${theme}`]: theme === 'light',
            [`${prefixCls}-rtl`]: direction === 'rtl',
        });
        const textStyle: CSSProperties = {};
        textStyle.maxWidth = textMaxWidth;
        const btnTheme = 'borderless';
        const btnSize = 'small';

        const reservedIndex = this.props.positionInList ? ( this.props.positionInList.length - this.props.positionInList.index - 1) : 0;
        const toastEle = <div
            ref={this.toastEle}
            role="alert"
            aria-label={`${type ? type : 'default'} type`}
            className={toastCls}
            style={{
                ...style,
                transform: `translate3d(0,0,${reservedIndex * -10}px)`,
            }}
            onMouseEnter={this.clearCloseTimer}
            onMouseLeave={this.startCloseTimer}
            onAnimationStart={this.props.onAnimationStart}
            onAnimationEnd={this.props.onAnimationEnd}
        >
            <div className={`${prefixCls}-content`}>
                {this.renderIcon()}
                <span className={`${prefixCls}-content-text`} style={textStyle} x-semi-prop="content">
                    {content}
                </span>
                {showClose && (
                    <div className={`${prefixCls}-close-button`}>
                        <Button
                            onClick={e => this.close(e)}
                            type="tertiary"
                            icon={<IconClose x-semi-prop="icon" />}
                            theme={btnTheme}
                            size={btnSize}
                        />
                    </div>
                )}
            </div>
        </div>;
        if (this.props.stack) {
            const height = this.props.stackExpanded && this.toastEle.current && getComputedStyle(this.toastEle.current).height || 0;
            return <div className={`${prefixCls}-zero-height-wrapper`} style={{ height }}>
                {toastEle}
            </div>;
        } else {
            return toastEle;
        }
        
    }
}

export default Toast;
