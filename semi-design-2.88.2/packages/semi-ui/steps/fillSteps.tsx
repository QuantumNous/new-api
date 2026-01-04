import React, { cloneElement, Children, useMemo, ReactElement, isValidElement } from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';
import { stepsClasses as css } from '@douyinfe/semi-foundation/steps/constants';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';
import { Row, Col } from '../grid';

export type Status = 'wait' | 'process' | 'finish' | 'error' | 'warning';
export type Direction = 'horizontal' | 'vertical';

export interface FillStepsProps {
    prefixCls?: string;
    className?: string;
    current?: number;
    direction?: Direction;
    initial?: number;
    status?: Status;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    onChange?: (current: number) => void;
    "aria-label"?: string
}

const Steps = (props: FillStepsProps) => {
    const { current = 0, status = 'process', children, prefixCls = css.PREFIX, initial = 0, direction = 'horizontal', className, style, onChange, ...rest } = props;
    const inner = useMemo(() => {
        const filteredChildren = Children.toArray(children).filter(c => isValidElement(c)) as Array<ReactElement<any>>;
        const colStyle = direction === 'vertical' ? null : { width: `${100 / filteredChildren.length}%` };
        const content = Children.map(filteredChildren, (child: ReactElement<any>, index) => {
            if (!child) {
                return null;
            }
            const stepNumber = initial + index;
            const childProps = {
                stepNumber: `${stepNumber + 1}`,
                direction,
                ...child.props,
            };

            if (status === 'error' && index === current - 1) {
                childProps.className = `${prefixCls}-next-error`;
            }

            if (!child.props.status) {
                if (stepNumber === current) {
                    childProps.status = status;
                } else if (stepNumber < current) {
                    childProps.status = 'finish';
                } else {
                    childProps.status = 'wait';
                }
            }
            childProps.onChange = onChange ? () => {
                if (index !== current) {
                    onChange(index + initial);
                }
            } : undefined;
            return <Col style={colStyle}>{cloneElement(child, { ...childProps })}</Col>;
        });
        return content;
    }, [children, initial, prefixCls, direction, status, current, onChange]);

    const wrapperCls = cls(className, {
        [prefixCls]: true,
        [`${prefixCls}-${direction}`]: true
    });

    return (
        <div
            className={wrapperCls}
            style={style}
            aria-label={props["aria-label"]}
            {...getDataAttr(rest)}
        >
            <Row type="flex" justify="start">
                {inner}
            </Row>
        </div>

    );
};


export default Steps;
