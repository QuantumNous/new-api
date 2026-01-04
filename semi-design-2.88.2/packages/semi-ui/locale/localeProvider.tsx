import React, { Component } from 'react';
import PropTypes from 'prop-types';
import LocaleContext from './context';
import DefaultLocale from './source/zh_CN';
import { Locale } from './interface';

export interface LocaleProviderProps {
    children?: React.ReactNode;
    locale?: Locale
}

export default class LocaleProvider extends Component<LocaleProviderProps> {
    static propTypes = {
        locale: PropTypes.object,
        children: PropTypes.node,
    };

    static defaultProps = {
        locale: DefaultLocale
    };

    constructor(props: LocaleProviderProps) {
        super(props);
        this.state = {};
    }

    render() {
        const { children, locale } = this.props;
        return (
            <LocaleContext.Provider value={locale}>
                {children}
            </LocaleContext.Provider>
        );
    }
}
