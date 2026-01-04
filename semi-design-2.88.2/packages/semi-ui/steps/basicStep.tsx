import React from 'react';
import { isFunction } from 'lodash';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { stepsClasses as css } from '@douyinfe/semi-foundation/steps/constants';
import { IconTickCircle, IconAlertCircle, IconAlertTriangle } from '@douyinfe/semi-icons';

export type Status = 'wait' | 'process' | 'finish' | 'error' | 'warning';
export type Size = 'default' | 'small';

export interface BasicStepProps {
    description?: React.ReactNode;
    icon?: React.ReactNode;
    status?: Status;
    title?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    active?: boolean;
    prefixCls?: string;
    stepNumber?: string;
    size?: Size;
    done?: boolean;
    onChange?: () => void;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
    "role"?: React.AriaRole;
    "aria-label"?: React.AriaAttributes["aria-label"]
}

export enum stepSizeMapIconSize {
    small = 'large',
    default = 'extra-large'
}

const BasicStep = (props: BasicStepProps) => {
    const {
        prefixCls = css.ITEM,
        className = '',
        size,
        title,
        description,
        status = 'wait',
        style,
        active = false,
        done = false,
        icon,
        stepNumber,
        onClick,
        onChange,
        onKeyDown,
    } = props;
    const renderIcon = () => {
        let inner, progress;

        if ('icon' in props) {
            if (React.isValidElement(icon)) {
                inner = icon;
            }
        } else if ('status' in props) {
            switch (status) {
                case 'error':
                    inner = <IconAlertCircle size={stepSizeMapIconSize[size]}/>;
                    break;
                case 'wait':
                    inner = <span className={`${prefixCls}-number-icon`}>{stepNumber}</span>;
                    break;
                case 'process':
                    inner = <span className={`${prefixCls}-number-icon`}>{stepNumber}</span>;
                    progress = true;
                    break;
                case 'finish':
                    inner = <IconTickCircle size={stepSizeMapIconSize[size]}/>;
                    break;
                case 'warning':
                    inner = <IconAlertTriangle size={stepSizeMapIconSize[size]}/>;
                    break;
                default:
                    inner = null;
                    break;
            }
        }
        const cls = classnames({
            [`${prefixCls}-icon`]: true,
            [`${prefixCls}-custom-icon`]: 'icon' in props,
            [`${prefixCls}-icon-process`]: progress,
        });

        return inner ? <span className={cls}>{inner}</span> : null;
    };
    const classString = classnames(prefixCls, `${prefixCls}-${status}`, {
        [`${prefixCls}-active`]: active,
        [`${prefixCls}-done`]: done,
        [`${prefixCls}-hover`]: onChange || props.onClick,
        [`${prefixCls}-clickable`]: (onChange || onClick),
        [`${prefixCls}-${status}-hover`]: onChange || props.onClick,
    }, className);
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(e);
        onChange?.();
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onKeyDown?.(e);
            onChange?.();
        }
    };
    return (
        <div role={props["role"]} aria-label={props["aria-label"]} tabIndex={0} aria-current="step"
            className={classString} style={style} onClick={e => handleClick(e)} onKeyDown={handleKeyDown}>
            <div className={`${prefixCls}-container`}>
                <div className={`${prefixCls}-left`}>{renderIcon()}</div>
                <div className={`${prefixCls}-content`}>
                    <div className={`${prefixCls}-title`}>
                        <div className={`${prefixCls}-title-text`}>{title}</div>
                    </div>
                    {description && <div className={`${prefixCls}-description`}>{description}</div>}
                </div>
            </div>
        </div>
    );
};


export default BasicStep;
