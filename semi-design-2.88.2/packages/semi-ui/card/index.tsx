import React, { PureComponent, ReactNode, CSSProperties } from 'react';
import { omit, isString } from 'lodash';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/card/constants';
import '@douyinfe/semi-foundation/card/card.scss';
import Meta from './meta';
import cls from 'classnames';
import Skeleton from '../skeleton';
import Typography from '../typography';
import Space from '../space';

const prefixcls = cssClasses.PREFIX;

export type Shadows = 'hover' | 'always';

export type { MetaProps } from './meta';

export type { CardGroupProps } from './cardGroup';

export interface CardProps {
    /** Operation group at the bottom of the card content area */
    actions?: ReactNode[];
    /** Card content area inline style */
    bodyStyle?: CSSProperties;
    /** Whether there is an outer border */
    bordered?: boolean;
    /** Style class name */
    className?: string;
    children?: React.ReactNode;
    /** Cover */
    cover?: ReactNode;
    /** Additional additions to the right of the title */
    headerExtraContent?: ReactNode;
    /** Custom end of page */
    footer?: ReactNode;
    /** Whether there is an edge between the bottom of the page and the content area */
    footerLine?: boolean;
    /** Inline style at the end of the page */
    footerStyle?: CSSProperties;
    /** Custom head */
    header?: ReactNode;
    /** Whether there is an edge line between the head and the content area */
    headerLine?: boolean;
    /** Head inline style */
    headerStyle?: CSSProperties;
    /** Whether to preload */
    loading?: boolean;
    /** Set shadow */
    shadows?: Shadows;
    /** Card inline style */
    style?: CSSProperties;
    /** Title */
    title?: ReactNode;
    /** aria label */
    'aria-label'?: string
}

class Card extends PureComponent<CardProps> {
    static Meta = Meta;

    static propTypes = {
        actions: PropTypes.array,
        bodyStyle: PropTypes.object,
        bordered: PropTypes.bool,
        children: PropTypes.node,
        className: PropTypes.string,
        cover: PropTypes.node,
        footer: PropTypes.node,
        footerLine: PropTypes.bool,
        footerStyle: PropTypes.object,
        header: PropTypes.node,
        headerExtraContent: PropTypes.node,
        headerLine: PropTypes.bool,
        headerStyle: PropTypes.object,
        loading: PropTypes.bool,
        shadows: PropTypes.oneOf(strings.SHADOWS),
        style: PropTypes.object,
        title: PropTypes.node,
        'aria-label': PropTypes.string,
    };

    static defaultProps = {
        bordered: true,
        footerLine: false,
        headerLine: true,
        loading: false
    };

    renderHeader = (): ReactNode => {
        const {
            title,
            headerExtraContent,
            header,
            headerLine,
            headerStyle
        } = this.props;
        const headerCls = cls(`${prefixcls}-header`, {
            [`${prefixcls}-header-bordered`]: Boolean(headerLine)
        });
        const headerWrapperCls = cls(`${prefixcls}-header-wrapper`);
        const titleCls = cls(`${prefixcls}-header-wrapper-title`, {
            [`${prefixcls}-header-wrapper-spacing`]: Boolean(headerExtraContent)
        });

        if (header || headerExtraContent || title) {
            return (
                <div style={headerStyle} className={headerCls}>
                    {header || ( // Priority of header over title and headerExtraContent
                        <div className={headerWrapperCls}>
                            {headerExtraContent && (
                                <div
                                    className={`${prefixcls}-header-wrapper-extra`}
                                    x-semi-prop="headerExtraContent"
                                >
                                    {headerExtraContent}
                                </div>
                            )}
                            {title && (
                                <div className={titleCls}>
                                    {isString(title) ? (
                                        <Typography.Title
                                            heading={6}
                                            ellipsis={{ showTooltip: true, rows: 1 }}
                                            x-semi-prop="title"
                                        >
                                            {title}
                                        </Typography.Title>
                                    ) : (
                                        title
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    renderCover = (): ReactNode => {
        const {
            cover
        } = this.props;
        const coverCls = cls(`${prefixcls}-cover`);

        return (
            cover && (
                <div className={coverCls} x-semi-prop="cover">
                    {cover}
                </div>
            )
        );
    };

    renderBody = (): ReactNode => {
        const { bodyStyle, children, actions, loading } = this.props;
        const bodyCls = cls(`${prefixcls}-body`);
        const actionsCls = cls(`${prefixcls}-body-actions`);
        const actionsItemCls = cls(`${prefixcls}-body-actions-item`);
        const placeholder = (
            <div>
                <Skeleton.Title />
                <br />
                <Skeleton.Paragraph rows={3} />
            </div>
        );
        return (
            <div style={bodyStyle} className={bodyCls}>
                {children && (
                    <Skeleton placeholder={placeholder} loading={loading} active>
                        {children}
                    </Skeleton>
                )}
                {
                    Array.isArray(actions) &&
                    (
                        <div className={actionsCls}>
                            <Space spacing={12}>
                                {actions.map((item, idx) => (
                                    <div key={idx} className={actionsItemCls} x-semi-prop={`actions.${idx}`}>{item}</div>
                                ))}
                            </Space>
                        </div>
                    )
                }
            </div>
        );
    };

    renderFooter = (): ReactNode => {
        const {
            footer,
            footerLine,
            footerStyle
        } = this.props;
        const footerCls = cls(`${prefixcls}-footer`, {
            [`${prefixcls}-footer-bordered`]: footerLine
        });

        return (
            footer && (
                <div style={footerStyle} className={footerCls} x-semi-prop="footer">
                    {footer}
                </div>
            )
        );
    };

    render(): ReactNode {
        const {
            bordered,
            shadows,
            style,
            className,
            ...otherProps
        } = this.props;
        const others = omit(otherProps, [ // Remove APIs in otherProps that do not need to be hung on the outer node
            'actions',
            'bodyStyle',
            'cover',
            'headerExtraContent',
            'footer',
            'footerLine',
            'footerStyle',
            'header',
            'headerLine',
            'headerStyle',
            'loading',
            'title'
        ]);
        const cardCls = cls(prefixcls, className, {
            [`${prefixcls}-bordered`]: bordered,
            [`${prefixcls}-shadows`]: shadows,
            [`${prefixcls}-shadows-${shadows}`]: shadows
        });

        return (
            <div {...others} aria-busy={this.props.loading} className={cardCls} style={style}>
                {this.renderHeader()}
                {this.renderCover()}
                {this.renderBody()}
                {this.renderFooter()}
            </div>
        );
    }
}

export default Card;