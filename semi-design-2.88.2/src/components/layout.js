/* eslint-disable max-lines-per-function */
/* eslint-disable max-len */
/**
 * Layout component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import 'normalize.css';

import '../styles/layout.scss';
import 'typeface-inter';
import 'typeface-inconsolata';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useStaticQuery, graphql } from 'gatsby';
import { IntlProvider } from 'react-intl';

import { LocaleProvider } from '@douyinfe/semi-ui';
import semiZhCN from '@douyinfe/semi-ui/locale/source/zh_CN';
import semiEnUS from '@douyinfe/semi-ui/locale/source/en_US';
import SemiSiteBanner from 'semi-site-banner';
import 'semi-site-banner/dist/index.css';

import appLocaleCN from '../locale/zh-CN';
import appLocaleUS from '../locale/en-US';

import Header from './header';
import SideNav from './side-nav';
import Footer from './Footer';
import { itemsArr } from 'utils/category';
import { getLocale, _t } from 'utils/locale';
import { useIde } from './useIde';
import "prismjs/components/prism-vala.js";


const insertScript = scriptText => {
    let sdk = document.createElement('script');
    sdk.type = 'text/javascript';
    sdk.innerHTML = scriptText;
    document.head.appendChild(sdk);
};

const AppLayout = ({ type, location, children }) => {
    const [showBanner, setShowBanner] = useState(false);
    const wrapperRef = useRef(null);
    
    const isIde = useIde({ wrapperRef });

    // ----------------START insert static code to document-------------------------
    useEffect(() => {
        if (window.insertSlardarAndHornbill) {
            return;
        }

        // remove the tabIndex of the gatsby-focus-wrapper div, to prevent the focus from starting after a mouse click 
        const gatsbyFocusWrapper = document.getElementById('gatsby-focus-wrapper');
        if (gatsbyFocusWrapper) {
            gatsbyFocusWrapper.removeAttribute('tabIndex');
        }
    
        Promise.resolve()
            .then(() => {
                // eslint-disable-next-line
                insertScript(`;(function (w, d, u, b, n, pc, ga, ae, po, s, p, e, t, pp) {pc = 'precollect';ga
                = 'getAttribute';ae = 'addEventListener';po = 'PerformanceObserver';s = function
                (m) {p = [].slice.call(arguments);p.push(Date.now(), location.href);(m == pc ?
                s.p.a : s.q).push(p)};s.q = [];s.p = { a: [] };w[n] = s;e =
                document.createElement('script');e.src = u + '?bid=' + b + '&globalName=' +
                n;e.crossOrigin = u.indexOf('sdk-web') > 0 ? 'anonymous' :
                'use-credentials';d.getElementsByTagName('head')[0].appendChild(e);if (ae in w)
                {s.pcErr = function (e) {e = e || w.event;t = e.target || e.srcElement;if (t
                instanceof Element || t instanceof HTMLElement) {if (t[ga]('integrity'))
                {w[n](pc, 'sri', t[ga]('href') || t[ga]('src'))} else {w[n](pc, 'st', { tagName:
                t.tagName, url: t[ga]('href') || t[ga]('src') })}} else {w[n](pc, 'err', e.error
                || e.message)}};s.pcRej = function (e) {e = e || w.event;w[n](pc, 'err',
                e.reason || (e.detail && e.detail.reason))};w[ae]('error', s.pcErr,
                true);w[ae]('unhandledrejection', s.pcRej,
                true);};if('PerformanceLongTaskTiming' in w) {pp = s.pp = { entries: []
                };pp.observer = new PerformanceObserver(function (l) {pp.entries =
                pp.entries.concat(l.getEntries())});pp.observer.observe({ entryTypes:
                ['longtask', 'largest-contentful-paint','layout-shift']
                })}})(window,document,'https://lf3-short.ibytedapm.com/slardar/fe/sdk-web/browser.cn.js','patrol_445','Slardar')`);
                insertScript(`
                window.Slardar && window.Slardar('init', { 
                        bid: 'patrol_445',
                        sample: {
                            sample_rate: 1,
                        },
                        plugins: {
                            ajax: {
                                ignoreUrls: [/.*/],
                            },
                            fetch: {
                                ignoreUrls: [/.*/],
                            },
                            resourceError: {
                                ignoreUrls: [/.*/],
                            },
                            jsError: false,
                        },
                    })
                    window.Slardar && window.Slardar('start')`
                );

            })
            .then(() => {
                window.insertSlardarAndHornbill = true;
            })
            .catch(e => {
                console.error('Insert Slardar Failed. Error: ', e);
            });
    }, []);
    // -----------------------------------------------------------------------------

    const showSideNav =
        location.pathname.replace(/(zh\-CN\/?|en\-US\/?)/, '') !== '/' && !/(showcase|resources|customers|contribute|teams)/g.test(location.pathname) && !isIde;
    
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
                            showNew
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

    const locale = getLocale(location.pathname);

    const messages = locale === 'zh-CN' ? appLocaleCN.messages : appLocaleUS.messages;

    const semiLocale = {
        'zh-CN': semiZhCN,
        'en-US': semiEnUS,
    };
    const semiLocaleSource = semiLocale[locale];

    const bannerRef = useCallback(node => {
        if (node !== null) {
            setShowBanner(true);
        } else {
            setShowBanner(false);
        }
    }, []);

    const headerStyle = {};
    const contentAeraStyle = {};
    const sideNavStyle = {};
    if (!showSideNav) {
        contentAeraStyle.paddingLeft = 0;
    }
    if (showBanner) {
        contentAeraStyle.paddingTop = 92;
        sideNavStyle.marginTop = 92;
    }

    useEffect(() => {
        setTimeout(()=>{
            console.clear();
        }, 1000);
    }, []);

    // TODO import semi common footer
    return (
        <>
            <IntlProvider locale={locale} messages={messages}>
                <LocaleProvider locale={semiLocaleSource}>
                    {
                        !isIde && (<div style={{ position: 'fixed', width: '100%', top: 0, zIndex: 999 }}>
                            <div className="skip-to-content">
                                <div>{locale === "zh-CN" ? '跳转到:' : 'skip to:'}</div>
                                <ol>
                                    {
                                        showSideNav ? (<li><a className="skip-to-content-link" href='#side-nav'>{locale === "zh-CN" ? '跳转到侧边导航' : 'skip to navigation'}</a></li>) : null
                                    }
                                    <li><a className="skip-to-content-link" href='#main-content'>{locale === "zh-CN" ? '跳转到主内容' : 'skip to main content'}</a></li>
                                    <li><a className="skip-to-content-link" href='#footer'>{locale === "zh-CN" ? '跳转到页脚' : 'skip to footer'}</a></li>
                                </ol>
                            </div>
                            <SemiSiteBanner ref={bannerRef} type="black" style={{ height: 32 }} icon={null} />
                            {/* ssr, can't use location directly, get location from layout and pass to children */}
                            <Header style={headerStyle} location={location} localeCode={locale} />
                        </div>)
                    }
                    {showSideNav ? (
                        <>
                            <SideNav hasBanner={showBanner} type={type} style={sideNavStyle} location={location} edges={data.allMdx.edges} itemsArr={itemsArr} />
                            {/* {footer} */}
                        </>
                    ) : null}
                    <div className="content-area" style={contentAeraStyle} id="main-content" ref={wrapperRef}>
                        {children}
                        {!/showcase|teams/.test(location.pathname) && <Footer />}
                    </div>
                </LocaleProvider>
            </IntlProvider>
        </>
    );
};

AppLayout.propTypes = {
    children: PropTypes.node.isRequired,
};

export default AppLayout;
