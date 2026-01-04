import React, { PureComponent, CSSProperties, ComponentType, FC, ReactElement, ReactNode } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/skeleton/constants';
import { strings } from '@douyinfe/semi-foundation/avatar/constants';

import '@douyinfe/semi-foundation/skeleton/skeleton.scss';

export type BasicProps = {
    prefixCls?: string;
    className?: string;
    style?: CSSProperties;
    type?: string
};

export interface ParagraphProps extends BasicProps {
    rows?: number
}

export interface AvatarProps extends BasicProps {
    size?: typeof strings.SIZE[number];
    shape?: string
}

export type GenericProps = BasicProps & AvatarProps;

const sizeSet = strings.SIZE;
const shapeSet = strings.SHAPE;

const generator = <T extends BasicProps>(type: string) => (BasicComponent: ComponentType<T>): FC<T> => (
    props
): ReactElement<any> => <BasicComponent type={type} {...props} />;

class Generic extends PureComponent<GenericProps> {
    static propTypes = {
        type: PropTypes.string,
        prefixCls: PropTypes.string,
        style: PropTypes.object,
        className: PropTypes.string,
        size: PropTypes.oneOf(sizeSet),
        shape: PropTypes.oneOf(shapeSet),
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
        size: 'medium',
        shape: 'circle',
    };

    render() {
        const { prefixCls, className, type, size, shape, ...others } = this.props;
        const classString = cls(
            className,
            `${prefixCls}-${type}`,
            {
                [`${prefixCls}-${type}-${size}`]: type.toUpperCase() === 'AVATAR',
            },
            {
                [`${prefixCls}-${type}-${shape}`]: type.toUpperCase() === 'AVATAR',
            }
        );
        return React.createElement('div', { className: classString, ...others });
    }
}

export const Avatar = generator<AvatarProps>('avatar')(Generic);
export const Image = generator<BasicProps>('image')(Generic);
export const Title = generator<BasicProps>('title')(Generic);
export const Button = generator<BasicProps>('button')(Generic);

export class Paragraph extends PureComponent<ParagraphProps> {
    static propTypes = {
        rows: PropTypes.number,
        prefixCls: PropTypes.string,
        style: PropTypes.object,
        className: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
        rows: 4,
    };

    render(): ReactNode {
        const { prefixCls, className, style, rows } = this.props;
        const classString = cls(className, `${prefixCls}-paragraph`);
        return (
            <ul className={classString} style={style}>
                {[...Array(rows)].map((e, i) => (
                    <li key={i} />
                ))}
            </ul>
        );
    }
}
