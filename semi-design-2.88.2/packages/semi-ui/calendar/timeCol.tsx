import React, { PureComponent } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import LocaleConsumer from '../locale/localeConsumer';
import localeContext from '../locale/context';
import { cssClasses } from '@douyinfe/semi-foundation/calendar/constants';

import '@douyinfe/semi-foundation/calendar/calendar.scss';
import { TimeColProps } from './interface';
import { Locale } from '../locale/interface';

const prefixCls = `${cssClasses.PREFIX}-time`;
export default class timeCol extends PureComponent<TimeColProps> {
    static propTypes = {
        className: PropTypes.string,
        renderTimeDisplay: PropTypes.func,
    };

    static contextType = localeContext;

    formatTime(item: number) {
        const { renderTimeDisplay } = this.props;
        if (typeof renderTimeDisplay === 'function') {
            return renderTimeDisplay(item);
        } else {
            const replaceTime = (template: string, time: number) => template.replace('${time}', String(time));
            return (
                <LocaleConsumer componentName="Calendar" key={`locale-${item}`}>
                    {(locale: Locale['Calendar']) => {
                        let time = item < 12 ? replaceTime(locale.AM, item) : replaceTime(locale.PM, item - 12);
                        if (item === 12) {
                            time = replaceTime(locale.PM, item);
                        }
                        return time;
                    }}
                </LocaleConsumer>
            );
        }
    }

    renderTime() {
        const { className } = this.props;
        const wrapperCls = cls(className, `${prefixCls}`);
        const list = [...Array(24).keys()].map(item => this.formatTime(item));
        list.splice(0, 1, '');
        const inner = list.map((item, index) => (
            <li key={`time-${index}`} className={`${prefixCls}-item`}>
                <span>{item}</span>
            </li>
        ));
        return (
            <div className={wrapperCls}>
                <ul className={`${prefixCls}-items`}>
                    {inner}
                </ul>
            </div>
        );
    }

    render() {
        const time = this.renderTime();
        return time;
    }
}
