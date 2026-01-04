import React from 'react';
import LocaleConsumer from '../locale/localeConsumer';
import BaseTimePicker, { TimePickerProps as BasePickerProps, BaseValueType } from './TimePicker';
import ConfigContext from '../configProvider/context';
import { get } from 'lodash';
import { Locale } from '../locale/interface';
import type { ValidateStatus } from '../_base/baseComponent';
import type { ScrollItemProps } from '../scrollList/scrollItem';
import { getDefaultPropsFromGlobalConfig } from "../_utils";

export type { TimeInputProps } from './TimeInput';
export type { TimePickerProps } from './TimePicker';
export type {
    BaseValueType,
    ScrollItemProps,
    ValidateStatus
};
export type LocalePickerProps = BasePickerProps;

export default class LocaleTimePicker extends React.PureComponent<LocalePickerProps> {
    static propTypes = BaseTimePicker.propTypes;
    static __SemiComponentName__ = "TimePicker";
    static defaultProps = getDefaultPropsFromGlobalConfig(LocaleTimePicker.__SemiComponentName__, BaseTimePicker.defaultProps);

    render() {
        const { type } = this.props;
        return (
            <ConfigContext.Consumer>
                {({ timeZone }: { timeZone?: string | number }) => (
                    <LocaleConsumer componentName="TimePicker">
                        {(locale: Locale['TimePicker'], localeCode: string, dateFnsLocale: Locale['dateFnsLocale']) => (
                            <BaseTimePicker
                                timeZone={timeZone}
                                placeholder={get(locale, ['placeholder', type])}
                                {...this.props}
                                locale={locale}
                                localeCode={localeCode}
                                dateFnsLocale={dateFnsLocale}
                            />
                        )}
                    </LocaleConsumer>
                )}
            </ConfigContext.Consumer>
        );
    }
}

