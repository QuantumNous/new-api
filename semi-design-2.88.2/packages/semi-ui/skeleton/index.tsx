import React, { PureComponent, ReactNode, CSSProperties } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/skeleton/constants';
import '@douyinfe/semi-foundation/skeleton/skeleton.scss';
import { Avatar, Image, Title, Button, Paragraph } from './item';

export type { ParagraphProps, AvatarProps, GenericProps } from './item';

const prefixCls = cssClasses.PREFIX;

export interface SkeletonProps {
    active?: boolean;
    children?: ReactNode;
    className?: string;
    loading?: boolean;
    placeholder?: ReactNode;
    style?: CSSProperties
}

class Skeleton extends PureComponent<SkeletonProps> {
    static Avatar = Avatar;
    static Title = Title;
    static Button = Button;
    static Paragraph = Paragraph;
    static Image = Image;

    static defaultProps = {
        loading: true,
    };

    static propTypes = {
        active: PropTypes.bool,
        placeholder: PropTypes.node,
        style: PropTypes.object,
        className: PropTypes.string,
        loading: PropTypes.bool,
        children: PropTypes.node,
    };

    render(): ReactNode {
        const { placeholder, active, children, className, loading, style, ...others } = this.props;
        const skCls = cls(prefixCls,
            {
                [`${prefixCls}-active`]: Boolean(active),
            },
            className);
        let content;
        if (loading) {
            content = (
                <div className={skCls} style={style} {...others} x-semi-prop="placeholder">
                    {placeholder}
                </div>
            );
        } else {
            content = children;
        }
        return content;
    }
}

export default Skeleton;
