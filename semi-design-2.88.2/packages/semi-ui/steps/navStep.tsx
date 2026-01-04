import React from 'react';
import PropTypes from 'prop-types';
import { isFunction } from 'lodash';
import classnames from 'classnames';
import { stepsClasses as css } from '@douyinfe/semi-foundation/steps/constants';
import { IconChevronRight } from '@douyinfe/semi-icons';

export interface NavStepProps {
    title?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    index?: number;
    active?: boolean;
    total?: number;
    prefixCls?: string;
    onChange?: () => void;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
    "role"?: React.AriaRole;
    "aria-label"?: React.AriaAttributes["aria-label"]
}

const NavStep = (props: NavStepProps) => {
    const { prefixCls = css.ITEM, className = '', title, style, active = false, index, total, onClick, onKeyDown, onChange } = props;
    const classString = classnames(prefixCls, {
        [`${prefixCls}-active`]: active
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
        <div role={props["role"]} aria-label={props["aria-label"]} aria-current="step" tabIndex={0} className={classString} style={style} onClick={e => handleClick(e)} onKeyDown={handleKeyDown}>
            <div className={`${prefixCls}-container`}>
                <div className={`${prefixCls}-content`}>
                    <div className={`${prefixCls}-title`}>
                        {title}
                    </div>
                </div>
                {index !== total - 1 && (
                    <div className={`${prefixCls}-icon`}>
                        <IconChevronRight size="small" />
                    </div>
                )}
            </div>
        </div>
    );
};


export default NavStep;
