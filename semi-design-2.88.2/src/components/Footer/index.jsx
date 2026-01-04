/* eslint-disable max-lines-per-function */
import React, { Component } from 'react';
import { FormattedMessage } from 'react-intl';

import './index.scss';
import { getLocale } from "../../utils/locale";
const _t = id => <FormattedMessage id={id} />;

export class Footer extends Component {


    render() {
        const locale = getLocale();
        const { style } = this.props;
        return (
            <footer className="footer" style={{ ...style, zIndex: 10, overflow: 'hidden' }}>
                <div className="footer-circle" />
                <div className="footer-link" style={{ width: "inherit" }}>
                    {/*<Icon className="footer-icon" type="doc-semi-logo" />*/}
                    <img alt="semi logo" style={{ height: "fit-content" }} aria-hidden src="https://lf9-static.semi.design/obj/semi-tos/images/a5768a90-324e-11ec-b393-ab4adc2e449f.svg" className='group6' />
                    <div className="link-col">
                        <p className="link-group">{_t('footer.design')}</p>
                        <a href={`/${locale}/start/introduction`}>Semi UI</a>
                        <a href={`/code`}>
                            Semi D2C
                        </a>
                        <a href={`/dsm`}>Semi DSM</a>
                        <a href={`/template`}>Semi Template</a>
                    </div>
                    <div className="link-col">
                        <p className="link-group">Semi x Figma</p>
                        <a
                            href={`https://www.figma.com/community/file/1034817675495341827`}
                        >
                            Figma UIKit
                        </a>
                        <a
                            href={`https://www.figma.com/community/file/1034817061440731906`}
                        >
                            Figma Iconset
                        </a>
                        <a
                            href={`https://www.figma.com/community/plugin/1166339852662786534/semi-design`}
                        >
                            Figma Plugin
                        </a>
                    </div>
                    <div className="link-col">
                        <p className="link-group">{_t('footer.getInfo')}</p>
                        <a href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=a12h8083-7d57-46cd-b431-5f388a0ce410">
                            {_t('footer.getInfo.lark')}
                        </a>
                        <a href="https://twitter.com/SemiDesignUI">
                            Twitter
                        </a>
                        <a href="https://medium.com/@semi-design">
                            Medium
                        </a>
                        <a href="https://dev.to/semidesign">
                            Dev.to
                        </a>
                        <a href="https://www.xiaohongshu.com/user/profile/5cf030c20000000010013636">
                            {_t('footer.getInfo.redBook')}
                        </a>
                    </div>
                    <div className="link-col">
                        <p className="link-group">{_t('footer.friends')}</p>
                        <a href={"https://www.rspack.dev/"}>
                            Rspack
                        </a>
                        <a href={"https://www.visactor.io/"}>
                            Visactor
                        </a>

                    </div>
                </div>
                <div className='autoWrapper'>
                    <div className='icpWrapper'>
                        <p className={'a2021SemiDesignAllRi'}>© 2021 - {new Date().getFullYear()} Semi Design. All rights reserved.</p>
                        {
                            getLocale() !== 'en-US' ? (
                                <>
                                    <a href="https://beian.miit.gov.cn/" target="_blank" className={'beianText'} rel="noreferrer">京ICP备19058139号-13</a>
                                    <img src="https://lf9-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/beian.png" className={'image45'} alt=''/>
                                    <a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=33011002016131" target="_blank" className={'beianText'} rel="noreferrer">浙公网安备 33011002016131号</a>
                                </>) : null
                        }
                    </div>
                    <p className='designedDevelopedWit'>
                        <span className='designedDevelopedWit_c0c5d39b'> Designed & Developed with love by </span>
                        <span className='designedDevelopedWit_6eaa79ba'>Douyin FE</span>
                        <span className='designedDevelopedWit_c0c5d39b'> & </span>
                        <a href="https://dribbble.com/MetaEnterpriseDesign" className='designedDevelopedWit_6eaa79ba'>MED</a>
                    </p>
                </div>
            </footer>
        );
    }
}

export default Footer;
