import { FormattedMessage } from 'react-intl';
import React from 'react';

const getLocale = path => {
    if (process.browser) {
        return window.localStorage.getItem('locale') ? window.localStorage.getItem('locale') : 'zh-CN';
    }
    let pathname = path;
    let locale = 'zh-CN';
    if (/en-US/.test(pathname)) {
        locale = 'en-US';
    }
    return locale;
};

const _t = id => <FormattedMessage id={id} />;

export { getLocale, _t };
