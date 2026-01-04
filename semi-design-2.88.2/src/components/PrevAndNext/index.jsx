/* eslint-disable max-depth */
import React, { Component, Fragment } from 'react';
import Icon from '@douyinfe/semi-ui/icons';
import './index.scss';
import { Link, withPrefix, useStaticQuery, graphql } from 'gatsby';
import { useIntl } from 'react-intl';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';
import IconMap from '../../images/docIcons';

class PrevAndNext extends Component {
    constructor(props) {
        super(props); 

        this.state = {
            prev: null,
            next: null,
        };
    }

    componentDidMount() {
        const { context, intl } = this.props;
        const { locale } = intl;
        const { pathname } = window.location;
        let prev = null;
        let next = null;

        for (let item of context) {
            if (item.localeCode === locale) {
                if (withPrefix(item.url) === pathname) {
                    const { order } = item;

                    for (let item of context) {
                        if (item.localeCode === locale && (item.order === order - 1 || item.order === order + 1)) {
                            item.order === order - 1 ? (prev = item) : (next = item);

                            if (prev && next) {
                                this.setState({
                                    prev,
                                    next,
                                });
                                return;
                            }
                        }
                    }
                }
            }
        }

        this.setState({
            prev,
            next,
        });
        return;
    }

    render() {
        const { prev, next } = this.state;
        const PrevIcon = prev ? IconMap[prev.icon] : Fragment;
        const NextIcon = next ? IconMap[next.icon] : Fragment;
        return (
            <div className="prev-next-nav">
                {prev && prev.url ? (
                    <Link to={`/${prev.url}` || ''} className="nav-item">
                        <Icon className="direction-icon" svg={<IconChevronLeft />} size="large" />
                        <div className="nav-detail">
                            <div className="nav-text align-right layout-col">
                                <div className="nav-path">{`${prev.category} / ${prev.title}`}</div>
                                <div className="nav-name">{prev.subtitle || prev.title}</div>
                            </div>
                            <Icon className="nav-icon" svg={<PrevIcon />} />
                        </div>
                    </Link>
                ) : (
                    <div />
                )}

                {next ? (
                    <Link to={`/${next.url}` || ''} className="nav-item">
                        <div className="nav-detail">
                            <Icon className="nav-icon" svg={<NextIcon />} />
                            <div className="nav-text align-left layout-col">
                                <div className="nav-path">{`${next.category} / ${next.title}`}</div>
                                <div className="nav-name">{next.subtitle || next.title}</div>
                            </div>
                        </div>
                        <Icon className="direction-icon" svg={<IconChevronRight />} size="large" />
                    </Link>
                ) : (
                    <div />
                )}
            </div>
        );
    }
}

export default () => {
    const data = useStaticQuery(graphql`
        query {
            allMdx(
                filter: { fields: { type: { nin: ["principles", "concepts"] } } }
                sort: { order: ASC, fields: [fields___typeOrder, fields___slug] }
            ) {
                edges {
                    node {
                        fields {
                            type
                            slug
                        }
                        frontmatter {
                            title
                            subTitle
                            localeCode
                            icon
                            order
                        }
                    }
                }
            }
            site {
                siteMetadata {
                    title
                }
            }
        }
    `);
    const context = [];
    data.allMdx.edges.map(item => {
        const { node } = item;
        context.push({
            category: node.fields.type,
            url: node.fields.slug,
            order: node.frontmatter.order,
            localeCode: node.frontmatter.localeCode,
            title: node.frontmatter.title,
            subtitle: node.frontmatter.subtitle,
            icon: node.frontmatter.icon,
        });
    });
    return <PrevAndNext context={context} intl={useIntl()} />;
};
