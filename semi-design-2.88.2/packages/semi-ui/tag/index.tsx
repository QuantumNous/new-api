import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/tag/constants';
import Avatar from '../avatar/index';
import { IconClose } from '@douyinfe/semi-icons';
import { TagProps, TagSize, TagColor, TagType } from './interface';
import { handlePrevent } from '@douyinfe/semi-foundation/utils/a11y';
import '@douyinfe/semi-foundation/tag/tag.scss';
import { isString } from 'lodash';
import cls from 'classnames';

export * from './interface';

const prefixCls = cssClasses.PREFIX;

const tagColors = strings.TAG_COLOR;

const tagSize = strings.TAG_SIZE;
const tagType = strings.TAG_TYPE;
const avatarShapeSet = strings.AVATAR_SHAPE;

export interface TagState {
    visible: boolean
}

export default class Tag extends Component<TagProps, TagState> {
    static defaultProps: TagProps = {
        size: tagSize[0] as TagSize,
        color: tagColors[0] as TagColor,
        closable: false,
        // visible: true,
        type: tagType[0] as TagType,
        onClose: () => undefined,
        onClick: () => undefined,
        onMouseEnter: () => undefined,
        style: {},
        className: '',
        shape: 'square',
        avatarShape: 'square',
        prefixIcon: null,
        suffixIcon: null,
        colorful: false,
        gradient: false,
    };

    static propTypes = {
        children: PropTypes.node,
        tagKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        size: PropTypes.oneOf(tagSize),
        color: PropTypes.oneOf(tagColors),
        type: PropTypes.oneOf(tagType),
        closable: PropTypes.bool,
        visible: PropTypes.bool,
        onClose: PropTypes.func,
        onClick: PropTypes.func,
        prefixIcon: PropTypes.node,
        suffixIcon: PropTypes.node,
        style: PropTypes.object,
        className: PropTypes.string,
        avatarSrc: PropTypes.string,
        colorful: PropTypes.bool,
        gradient: PropTypes.bool,
        avatarShape: PropTypes.oneOf(avatarShapeSet),
        'aria-label': PropTypes.string,
    };

    constructor(props: TagProps) {
        super(props);
        this.state = {
            visible: true,
        };
        this.close = this.close.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    // any other way to achieve this?
    static getDerivedStateFromProps(nextProps: TagProps) {
        if ('visible' in nextProps) {
            return {
                visible: nextProps.visible,
            };
        }
        return null;
    }

    setVisible(visible: boolean) {
        if (!('visible' in this.props)) {
            this.setState({ visible });
        }
    }

    close(e: React.MouseEvent<HTMLElement>, value: React.ReactNode, tagKey: string | number) {
        const { onClose } = this.props;
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onClose && onClose(value, e, tagKey);
        // when user call e.preventDefault() in onClick callback, tag will not hidden
        if (e.defaultPrevented) {
            return;
        }
        this.setVisible(false);
    }

    handleKeyDown(event: any) {
        const { closable, onClick, onKeyDown } = this.props;
        switch (event.key) {
            case "Backspace":
            case "Delete":
                closable && this.close(event, this.props.children, this.props.tagKey);
                handlePrevent(event);
                break;
            case "Enter":
                onClick(event);
                handlePrevent(event);
                break;
            case 'Escape':
                event.target.blur();
                break;
            default:
                break;
        }
        onKeyDown && onKeyDown(event);
    }

    renderAvatar() {
        const { avatarShape, avatarSrc } = this.props;
        const avatar = <Avatar src={avatarSrc} shape={avatarShape} />;
        return avatar;
    }

    render() {
        const { tagKey, children, size, color, closable, visible, onClose, onClick, className, type, shape, avatarSrc, avatarShape, tabIndex, prefixIcon, suffixIcon, colorful, gradient, ...attr } = this.props;
        const { visible: isVisible } = this.state;
        const clickable = onClick !== Tag.defaultProps.onClick || closable;
        // only when the Tag is clickable or closable, the value of tabIndex is allowed to be passed in. 
        const a11yProps = { role: 'button', tabIndex: tabIndex || 0, onKeyDown: this.handleKeyDown };
        const baseProps = {
            ...attr,
            onClick,
            tabIndex: tabIndex,
            className: classNames(
                prefixCls,
                {
                    [`${prefixCls}-default`]: size === 'default',
                    [`${prefixCls}-small`]: size === 'small',
                    [`${prefixCls}-large`]: size === 'large',
                    [`${prefixCls}-square`]: shape === 'square',
                    [`${prefixCls}-circle`]: shape === 'circle',
                    [`${prefixCls}-${type}`]: type,
                    [`${prefixCls}-${color}-${type}`]: color && type,
                    [`${prefixCls}-closable`]: closable,
                    [`${prefixCls}-invisible`]: !isVisible,
                    [`${prefixCls}-avatar-${avatarShape}`]: avatarSrc,
                    [`${prefixCls}-colorful`]: colorful,
                    [`${prefixCls}-gradient`]: gradient
                },
                className
            ),
        };
        const wrapProps = clickable ? ({ ...baseProps, ...a11yProps }) : baseProps;
        const closeIcon = closable ? (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div className={`${prefixCls}-close`} onClick={e => this.close(e, children, tagKey)}>
                <IconClose size="small" />
            </div>
        ) : null;
        const stringChild = isString(children);
        const contentCls = cls(`${prefixCls}-content`, `${prefixCls}-content-${stringChild ? 'ellipsis' : 'center' }`);

        return (
            <div aria-label={this.props['aria-label'] || stringChild ? `${closable ? 'Closable ' : ''}Tag: ${children}` : '' } {...wrapProps}>
                {prefixIcon ? <div className={`${prefixCls}-prefix-icon`}>{prefixIcon}</div> : null}
                {avatarSrc ? this.renderAvatar() : null}
                <div className={contentCls}>
                    {children}
                </div>
                {suffixIcon ? <div className={`${prefixCls}-suffix-icon`}>{suffixIcon}</div> : null}
                {closeIcon}
            </div>
        );
    }
}
