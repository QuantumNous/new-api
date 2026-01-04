/* eslint-disable max-lines-per-function */
import React, { Component } from 'react';
import UserContext from 'context/context';
import './footer.scss';
import { _t } from 'src/utils/locale';
import { getLocale } from '../../utils/locale';
import { IconBytedanceLogo } from '@douyinfe/semi-icons';

export class Footer extends Component {
    static contextType = UserContext;

    render() {
        return (
            <div className='footerMini8' id="footer"><img alt="semi logo" aria-hidden src="https://lf9-static.semi.design/obj/semi-tos/images/a5768a90-324e-11ec-b393-ab4adc2e449f.svg" className='group6' />
                <div className='links'>
                    <a href={`/${getLocale()}/start/getting-started`} className='text'>{_t('footer.component')}</a>
                    <a href='https://figma.com/@semi' className='figmaUIKit' target="_blank" rel="noreferrer">Figma UIKit</a>
                    <p className='text_d3ba282e'><a href={DSM_URL?DSM_URL:"https://semi.design/dsm/landing"} className='text_8b88424e' target="_blank" rel="noreferrer">{_t('footer.dsm')}</a></p>
                    <a href="https://github.com/DouyinFE/semi-design" className='github' target="_blank" rel="noreferrer">GitHub</a>
                </div>
                <img src="https://lf9-static.semi.design/obj/semi-tos/images/a577c310-324e-11ec-8b14-8fb159794ae4.svg" className='divider' aria-hidden alt='' />
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
            </div>
        );
    }
}
export default Footer;
