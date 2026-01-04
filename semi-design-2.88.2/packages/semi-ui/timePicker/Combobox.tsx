import React from 'react';
import PropTypes from 'prop-types';
import { format as dateFnsFormat } from 'date-fns';
import { noop } from 'lodash';

import BaseComponent, { BaseProps } from '../_base/baseComponent';
import { strings } from '@douyinfe/semi-foundation/timePicker/constants';
import ScrollList from '../scrollList/index';
import ScrollItem from '../scrollList/scrollItem';
import ComboboxFoundation, { formatOption } from '@douyinfe/semi-foundation/timePicker/ComboxFoundation';
import LocaleConsumer from '../locale/localeConsumer';
import { TimePickerProps } from './TimePicker';
import { Locale } from '../locale/interface';


export type ComboboxProps = Pick<TimePickerProps, 'format' | 'prefixCls' | 'disabledHours' |
'disabledMinutes' |
'disabledSeconds' |
'hideDisabledOptions' |
'use12Hours' |
'scrollItemProps' |
'panelFooter' |
'panelHeader'> & BaseProps & {
    defaultOpenValue?: TimePickerProps['value'];
    showHour?: boolean;
    showMinute?: boolean;
    showSecond?: boolean;
    onChange?: (value: { isAM: boolean; value: string; timeStampValue: number }) => void;
    onCurrentSelectPanelChange?: (range: string) => void;
    isAM?: boolean;
    timeStampValue?: any
};

export interface ComboboxState {
    showHour: boolean;
    showMinute: boolean;
    showSecond: boolean;
    hourOptions: number[];
    minuteOptions: number[];
    secondOptions: number[]
}

export type FormatOptionReturn = ReturnType<typeof formatOption>;
export interface AMPMOptionItem {
    value: string;
    text: string
}

class Combobox extends BaseComponent<ComboboxProps, ComboboxState> {
    static propTypes = {
        format: PropTypes.string,
        defaultOpenValue: PropTypes.object,
        prefixCls: PropTypes.string,
        onChange: PropTypes.func,
        showHour: PropTypes.bool,
        showMinute: PropTypes.bool,
        showSecond: PropTypes.bool,
        disabledHours: PropTypes.func,
        disabledMinutes: PropTypes.func,
        disabledSeconds: PropTypes.func,
        hideDisabledOptions: PropTypes.bool,
        onCurrentSelectPanelChange: PropTypes.func,
        use12Hours: PropTypes.bool,
        isAM: PropTypes.bool,
        timeStampValue: PropTypes.any,
        scrollItemProps: PropTypes.object,
    };

    static defaultProps = {
        disabledHours: noop,
        disabledMinutes: noop,
        disabledSeconds: noop,
        format: strings.DEFAULT_FORMAT,
    };

    foundation: ComboboxFoundation;

    constructor(props: ComboboxProps) {
        super(props);

        this.foundation = new ComboboxFoundation(this.adapter);
        this.state = {
            ...this.foundation.initData(),
        };
    }

    componentDidUpdate(prevProps: ComboboxProps, prevState: ComboboxState) {
        if (prevProps.timeStampValue !== this.props.timeStampValue || prevProps.format !== this.props.format) {
            this.setState({
                ...this.foundation.initData(),
            });
        }
    }

    componentWillUnmount() {
        // this.foundation.destroy();
    }

    componentDidMount() {
        // this.foundation.init();
    }

    cacheRefCurrent = (key: string, current: ScrollItem<FormatOptionReturn> | ScrollItem<AMPMOptionItem>) => {
        if (key && typeof key === 'string') {
            this.adapter.setCache(key, current);
        }
    };

    reselect = () => {
        const currentKeys = ['ampm', 'hour', 'minute', 'second'];

        currentKeys.forEach(key => {
            const current = this.adapter.getCache(key);

            if (current && current.scrollToIndex) {
                current.scrollToIndex();
            }
        });
    };

    onItemChange = ({ type, value, disabled }: { type?: string; value: string; disabled?: boolean }) => {
        let { onChange, use12Hours, isAM, format, timeStampValue } = this.props;
        const transformValue = this.foundation.getDisplayDateFromTimeStamp(timeStampValue);
        // TODO: foundation
        if (type === 'hour') {
            if (use12Hours) {
                if (isAM) {
                    transformValue.setHours(Number(value) % 12);
                } else {
                    transformValue.setHours((Number(value) % 12) + 12);
                }
            } else {
                transformValue.setHours(Number(value));
            }
        } else if (type === 'minute') {
            transformValue.setMinutes(Number(value));
        } else if (type === 'ampm') {
            const ampm = value.toUpperCase();
            if (use12Hours) {
                if (ampm === 'PM') {
                    isAM = false;
                    transformValue.getHours() < 12 && transformValue.setHours((transformValue.getHours() % 12) + 12);
                }

                if (ampm === 'AM') {
                    isAM = true;
                    transformValue.getHours() >= 12 && transformValue.setHours(transformValue.getHours() - 12);
                }
            }
        } else {
            transformValue.setSeconds(Number(value));
        }

        onChange &&
            onChange({
                isAM,
                value: dateFnsFormat(transformValue, format && format.replace(/(\s+)A/g, '$1a')), // dateFns only supports "h: mm: ss a"
                timeStampValue: Number(transformValue),
            });
    };

    onEnterSelectPanel = (range: string) => {
        const { onCurrentSelectPanelChange } = this.props;

        onCurrentSelectPanelChange(range);
    };

    renderHourSelect(hour: number, locale: Locale['TimePicker']) {
        const { prefixCls, disabledHours, use12Hours, scrollItemProps } = this.props;

        const { showHour, hourOptions } = this.state;

        if (!showHour) {
            return null;
        }
        const disabledOptions = disabledHours();

        let hourOptionsAdj,
            hourAdj;
        if (use12Hours) {
            hourOptionsAdj = [12].concat(hourOptions.filter(h => h < 12 && h > 0));
            hourAdj = hour % 12 || 12;
        } else {
            hourOptionsAdj = hourOptions;
            hourAdj = hour;
        }

        const transformHour = (value: string) => value + locale.hour;

        const className = `${prefixCls}-list-hour`;

        return (
            <ScrollItem<FormatOptionReturn>
                ref={current => this.cacheRefCurrent('hour', current)}
                mode={'normal'}
                transform={transformHour}
                className={className}
                list={hourOptionsAdj.map(option => formatOption(option, disabledOptions))}
                selectedIndex={hourOptionsAdj.indexOf(hourAdj)}
                type="hour"
                onSelect={this.onItemChange}
                {...scrollItemProps}
            />
        );
    }

    renderMinuteSelect(minute: number, locale: Locale['TimePicker']) {
        const { prefixCls, disabledMinutes, timeStampValue, scrollItemProps } = this.props;

        const { showMinute, minuteOptions } = this.state;

        if (!showMinute) {
            return null;
        }
        const value = new Date(timeStampValue);
        const disabledOptions = disabledMinutes && disabledMinutes(value.getHours());

        const className = `${prefixCls}-list-minute`;

        const transformMinute = (min: string) => min + locale.minute;

        return (
            <ScrollItem<FormatOptionReturn>
                ref={current => this.cacheRefCurrent('minute', current)}
                mode={'normal'}
                transform={transformMinute}
                list={minuteOptions.map(option => formatOption(option, disabledOptions))}
                selectedIndex={minuteOptions.indexOf(minute)}
                type="minute"
                onSelect={this.onItemChange}
                className={className}
                {...scrollItemProps}
            />
        );
    }

    renderSecondSelect(second: number, locale: Locale['TimePicker']) {
        const { prefixCls, disabledSeconds, timeStampValue, scrollItemProps } = this.props;

        const { showSecond, secondOptions } = this.state;

        if (!showSecond) {
            return null;
        }
        const value = new Date(timeStampValue);

        const disabledOptions = disabledSeconds && disabledSeconds(value.getHours(), value.getMinutes());

        const className = `${prefixCls}-list-second`;

        const transformSecond = (sec: number) => String(sec) + locale.second;

        return (
            <ScrollItem<FormatOptionReturn>
                ref={current => this.cacheRefCurrent('second', current)}
                mode={'normal'}
                transform={transformSecond}
                list={secondOptions.map(option => formatOption(option, disabledOptions))}
                selectedIndex={secondOptions.indexOf(second)}
                className={className}
                type="second"
                onSelect={this.onItemChange}
                {...scrollItemProps}
            />
        );
    }

    renderAMPMSelect(locale: Locale['TimePicker'], localeCode: string) {
        const { prefixCls, use12Hours, isAM, scrollItemProps } = this.props;
        if (!use12Hours) {
            return null;
        }

        const AMPMOptions: AMPMOptionItem[] = [
            {
                value: 'AM',
                text: locale.AM || '上午',
            },
            {
                value: 'PM',
                text: locale.PM || '下午',
            },
        ];

        const selected = isAM ? 0 : 1;

        const className = `${prefixCls}-list-ampm`;

        return (
            <ScrollItem<AMPMOptionItem>
                ref={current => this.cacheRefCurrent('ampm', current)}
                mode={'normal'}
                className={className}
                list={AMPMOptions}
                selectedIndex={selected}
                type="ampm"
                onSelect={this.onItemChange}
                {...scrollItemProps}
            />
        );
    }

    getDisplayDateFromTimeStamp = (timeStampValue: Date | string) => this.foundation.getDisplayDateFromTimeStamp(timeStampValue);

    render() {
        const { timeStampValue, panelHeader, panelFooter } = this.props;

        const value = this.getDisplayDateFromTimeStamp(timeStampValue);

        return (
            <LocaleConsumer componentName="TimePicker">
                {(locale: Locale['TimePicker'], localeCode: Locale['code']) => (
                    <ScrollList
                        header={panelHeader}
                        footer={panelFooter}
                        x-semi-header-alias="panelHeader"
                        x-semi-footer-alias="panelFooter"
                    >
                        {this.renderAMPMSelect(locale, localeCode)}
                        {this.renderHourSelect(value.getHours(), locale)}
                        {this.renderMinuteSelect(value.getMinutes(), locale)}
                        {this.renderSecondSelect(value.getSeconds(), locale)}
                    </ScrollList>
                )}
            </LocaleConsumer>
        );
    }
}
export default Combobox;
