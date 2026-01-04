import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/card/constants';
import cls from 'classnames';

const prefixcls = cssClasses.PREFIX;

export type Shadows = 'hover' | 'show';

export interface MetaProps {
    /** Avatar */
    avatar?: React.ReactNode;
    /** Style class name */
    className?: string;
    /** Description */
    description?: React.ReactNode;
    /** Inline style */
    style?: React.CSSProperties;
    /** Title */
    title?: React.ReactNode
}

class Meta extends PureComponent<MetaProps> {
    static propTypes = {
        avatar: PropTypes.node,
        className: PropTypes.string,
        description: PropTypes.node,
        style: PropTypes.object,
        title: PropTypes.node
    };

    render() {
        const {
            avatar,
            className,
            description,
            style,
            title,
            ...others
        } = this.props;
        const metaCls = cls(`${prefixcls}-meta`, className);
        const avatarNode = avatar && (
            <div className={`${prefixcls}-meta-avatar`}>
                {avatar}
            </div>
        );
        const titleNode = title && (
            <div className={`${prefixcls}-meta-wrapper-title`}>
                {title}
            </div>
        );
        const descriptionNode = description && (
            <div className={`${prefixcls}-meta-wrapper-description`}>
                {description}
            </div>
        );
        const wrapper = title || description ? (
            <div className={`${prefixcls}-meta-wrapper`}>
                {titleNode}
                {descriptionNode}
            </div>
        ) : null;

        return (
            <div {...others} className={metaCls} style={style}>
                {avatarNode}
                {wrapper}
            </div>
        );
    }
}

export default Meta;