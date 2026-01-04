import React, { Component } from 'react';
import { Locale as dateFns } from 'date-fns';
import PropTypes from 'prop-types';
import { get } from 'lodash';
import LocaleContext from './context';
import ConfigContext from '../configProvider/context';
import DefaultLocale from './source/zh_CN';
import { Locale } from './interface';

type ChildrenRender<T> = (componentLocal: T, localeCode: string, dateFnsLocale: dateFns, currency: string) => React.ReactNode;
export interface LocaleConsumerProps<T> {
    componentName: string;
    children?: ChildrenRender<T>
}

export default class LocaleConsumer<T> extends Component<LocaleConsumerProps<T>> {
    static propTypes = {
        componentName: PropTypes.string.isRequired,
        children: PropTypes.any,
    };

    static defaultProps = {
        componentName: '',
    };

    renderChildren(localeData: Locale, children: ChildrenRender<T>) {
        const { componentName } = this.props;
        let locale = localeData;
        if (!localeData?.code) {
            locale = DefaultLocale;
        }
        /**
         * dateFnsLocale is used to format the date into a local date
         * example:
         *  import { zhCN } from "date-fns/locale";
         *  format(new Date("2021-04-29"), "yyyy-MM-dd EEEE")
         *      => '2021-04-29 Thursday' (默认 locale 为 en-US)
         *  format(new Date('2021-04-29'), "yyyy-MM-dd EEEE", { locale: zhCN })
         *      => '2021-04-29 星期四'
         */
        const defaultFnsLocale = get(DefaultLocale, 'dateFnsLocale');
        const dateFnsLocale = get(locale, 'dateFnsLocale', defaultFnsLocale);
        const currency = get(locale, 'currency');  
        return children(locale[componentName], locale.code, dateFnsLocale, currency);
    }

    render() {
        const { children } = this.props;
        return (
            <ConfigContext.Consumer>
                {({ locale }) => (
                    <LocaleContext.Consumer>
                        {localeData => this.renderChildren(locale || localeData, children)}
                    </LocaleContext.Consumer>
                )}
            </ConfigContext.Consumer>
        );
    }
}
