import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/tag/constants';
import Tag from './index';
import Popover from '../popover/index';
import { AvatarShape, TagProps, TagGroupProps } from './interface';

const prefixCls = cssClasses.PREFIX;
const tagSize = strings.TAG_SIZE;
const avatarShapeSet = strings.AVATAR_SHAPE;

export default class TagGroup<T> extends PureComponent<TagGroupProps<T>> {
    static defaultProps = {
        style: {},
        className: '',
        size: tagSize[0],
        avatarShape: 'square',
        onTagClose: () => undefined,
        onPlusNMouseEnter: () => undefined,
    };

    static propTypes = {
        children: PropTypes.node,
        style: PropTypes.object,
        className: PropTypes.string,
        maxTagCount: PropTypes.number,
        restCount: PropTypes.number,
        tagList: PropTypes.array,
        size: PropTypes.oneOf(tagSize),
        mode: PropTypes.string,
        onTagClose: PropTypes.func,
        showPopover: PropTypes.bool,
        popoverProps: PropTypes.object,
        avatarShape: PropTypes.oneOf(avatarShapeSet),
    };

    renderNTag(n: number, restTags: React.ReactNode) {
        const { size, showPopover, popoverProps, onPlusNMouseEnter } = this.props;
        let nTag = (
            <Tag
                closable={false}
                size={size}
                color="grey"
                style={{ backgroundColor: 'transparent' }}
                key="_+n"
                onMouseEnter={onPlusNMouseEnter}
            >
                +{n}
            </Tag>
        );

        if (showPopover) {
            nTag = (
                <Popover
                    showArrow
                    content={restTags}
                    trigger="hover"
                    position="top"
                    autoAdjustOverflow
                    className={`${prefixCls}-rest-group-popover`}
                    {...popoverProps}
                    key="_+n_Popover"
                >
                    {nTag}
                </Popover>
            );
        }
        return nTag;
    }

    renderMergeTags(tags: (Tag | React.ReactNode)[]) {
        const { maxTagCount, tagList, restCount } = this.props;
        const n = restCount ? restCount : tagList.length - maxTagCount;
        let renderTags: (Tag | React.ReactNode)[] = tags;

        const normalTags: (Tag | React.ReactNode)[] = tags.slice(0, maxTagCount);
        const restTags = tags.slice(maxTagCount) as React.ReactNode;
        let nTag = null;
        if (n > 0) {
            nTag = this.renderNTag(n, restTags);
            normalTags.push(nTag);
            renderTags = normalTags;
        }
        return renderTags;
    }

    renderAllTags() {
        const { tagList, size, mode, avatarShape, onTagClose } = this.props;
        const renderTags = tagList.map((tag): (Tag | React.ReactNode) => {
            if (mode === 'custom') {
                return tag as React.ReactNode;
            }
            const newTag = { ...(tag as TagProps) }; 
            if (!(newTag as TagProps).size) {
                (newTag as TagProps).size = size;
            }
            
            if (!(newTag as TagProps).avatarShape) {
                (newTag as TagProps).avatarShape = avatarShape;
            }

            if (!(newTag as TagProps).tagKey) {
                if (typeof (newTag as TagProps).children === 'string' || typeof (newTag as TagProps).children === 'number') {
                    (newTag as TagProps).tagKey = (newTag as TagProps).children as string | number;
                } else {
                    (newTag as TagProps).tagKey = Math.random();
                }
            }
            return <Tag {...(newTag as TagProps)} key={(newTag as TagProps).tagKey} onClose={(tagChildren, e, tagKey) => {
                if ((newTag as TagProps).onClose) {
                    (newTag as TagProps).onClose(tagChildren, e, tagKey);
                }
                onTagClose && onTagClose(tagChildren, e, tagKey);
            }} />;
        });
        return renderTags;
    }

    render() {
        const { style, className, maxTagCount, size } = this.props;

        const groupCls = classNames({
            [`${prefixCls}-group`]: true,
            [`${prefixCls}-group-max`]: maxTagCount,
            [`${prefixCls}-group-small`]: size === 'small',
            [`${prefixCls}-group-large`]: size === 'large',
        }, className);

        const tags = this.renderAllTags();
        const tagContents = (typeof maxTagCount === 'undefined' ? tags : this.renderMergeTags(tags)) as React.ReactNode;

        return (
            <div style={style} className={groupCls}>
                {tagContents}
            </div>
        );
    }
}
