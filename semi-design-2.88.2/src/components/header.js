import React from 'react';
import { _t } from 'utils/locale';
import SemiSiteHeader from 'semi-site-header';
import 'semi-site-header/dist/index.css';
import { navigate } from 'gatsby';

const Header = ({ location, localeCode, style }) => (
    <div>
        <SemiSiteHeader
            style={style}
            onDarkChange={(mode)=>{
                const iframeDOM=document.querySelector('iframe');
                try {
                    iframeDOM?.contentWindow?.semidoc?.setDarkmode(mode==='dark');
                } catch (e) {

                }
            }}
            onLocaleChange={locale => {
                localStorage.setItem('locale', locale);
                navigate(location.pathname.replace(/zh-CN|en-US/, locale));
                return false;
            }}
        />
    </div>
);

export default Header;
