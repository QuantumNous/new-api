import React from 'react';
import { isFunction } from 'lodash';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { stepsClasses as css } from '@douyinfe/semi-foundation/steps/constants';
import { IconTickCircle, IconAlertCircle, IconAlertTriangle } from '@douyinfe/semi-icons';

export type Status = 'wait' | 'process' | 'finish' | 'error' | 'warning';

export interface FillStepProps {
    description?: React.ReactNode;
    icon?: React.ReactNode;
    status?: Status;
    title?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    prefixCls?: string;
    stepNumber?: string;
    onChange?: () => void;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
    "role"?: React.AriaRole;
    "aria-label"?: React.AriaAttributes["aria-label"]
}

const FillStep = (props: FillStepProps) => {
    const { prefixCls = css.ITEM, className = '', title, description, status = 'wait', style, onClick, icon, onChange, stepNumber, onKeyDown } = props;
    const renderIcon = () => {
        let inner, progress;

        if ('icon' in props) {
            inner = icon;
        } else if ('status' in props) {
            switch (status) {
                case 'error':
                    inner = <IconAlertCircle size="extra-large" />;
                    break;
                case 'wait':
                    inner = stepNumber;
                    break;
                case 'process':
                    inner = stepNumber;
                    progress = true;
                    break;
                case 'finish':
                    inner = <IconTickCircle size="extra-large" />;
                    break;
                case 'warning':
                    inner = <IconAlertTriangle size="extra-large" />;
                    break;
                default:
                    inner = null;
                    break;
            }
        }
        const cls = classnames({
            [`${prefixCls}-left`]: true,
            [`${prefixCls}-icon`]: 'icon' in props,
            [`${prefixCls}-plain`]: !('icon' in props),
            [`${prefixCls}-icon-process`]: progress,
            [`${prefixCls}-hover`]: onChange || onClick,
        });

        return inner ? <div className={cls}>{inner}</div> : null;
    };
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
        <div
            role={props["role"]}
            aria-label={props["aria-label"]}
            aria-current="step"
            tabIndex={0} 
            className={classnames({
                [prefixCls]: true,
                [`${prefixCls}-${status}`]: Boolean(status),
                [`${prefixCls}-${status}-hover`]: Boolean(status) && (onChange || onClick),
                [`${prefixCls}-${status}-active`]: Boolean(status) && (onChange || onClick),
                [`${prefixCls}-clickable`]: (onChange || onClick),
            }, className)}
            style={style}
            onClick={e => {
                handleClick(e);
            }}
            onKeyDown={handleKeyDown}
        >
            {renderIcon()}
            <div className={`${prefixCls}-content`}>
                <div className={`${prefixCls}-title`} title={typeof title === 'string' ? title : null}>
                    <span className={`${prefixCls}-title-text`}>{title}</span>
                </div>
                <div
                    className={`${prefixCls}-description`}
                    title={typeof description === 'string' ? description : null}
                >
                    {description}
                </div>
            </div>
        </div>
    );
};


export default FillStep;
