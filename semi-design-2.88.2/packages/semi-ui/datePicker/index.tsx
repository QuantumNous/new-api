import React from 'react';

import { forwardStatics } from '@douyinfe/semi-foundation/utils/object';
import { numbers, strings } from '@douyinfe/semi-foundation/datePicker/constants';
import DatePicker, { DatePickerProps } from './datePicker';
import ConfigContext from '../configProvider/context';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';

export type {
    BaseValueType,
    DayStatusType,
    DisabledDateOptions,
    DisabledDateType,
    DisabledTimeType,
    InputSize,
    Position,
    PresetType,
    PresetsType,
    TriggerRenderProps,
    ValidateStatus,
    ValueType,
} from '@douyinfe/semi-foundation/datePicker/foundation';
export type { DateInputProps } from './dateInput';
export type { DatePickerProps } from './datePicker';
export type { MonthProps } from './month';
export type { MonthsGridProps } from './monthsGrid';
export type { QuickControlProps } from './quickControl';
export type { YearAndMonthProps } from './yearAndMonth';
export type { InsetInputProps } from '@douyinfe/semi-foundation/datePicker/inputFoundation';
export type { DatePicker as BaseDatePicker };

export default forwardStatics(
    React.forwardRef<DatePicker, DatePickerProps>((props, ref) => {
        const propsObj = { ...props };
        const { type, format, rangeSeparator } = propsObj;

        if (typeof format === 'string' && format) {
            if (!/[Hhms]+/.test(format)) {
                if (type === 'dateTime') {
                    propsObj.type = 'date';
                } else if (type === 'dateTimeRange') {
                    propsObj.type = 'dateRange';
                }
            }
        }

        // Add spaces at both ends to prevent conflicts with characters in the date when separating
        if (rangeSeparator && typeof rangeSeparator === 'string') {
            propsObj.rangeSeparator = ` ${rangeSeparator.trim()} `;
        }

        if (propsObj.insetInput) {
            if (!propsObj.position) {
                propsObj.position = strings.POSITION_INLINE_INPUT;
            }
            /**
             * When insetInput is `true` and `position` includes `over`, use 1px `spacing` to solve the problem of border-radius leakage in the upper left corner
             * 
             * @see https://user-images.githubusercontent.com/26477537/158817185-126a5f33-41f7-414a-8e36-8d1be2dda5cd.png
             */
            if (propsObj.position.includes('Over') && !propsObj.spacing) {
                propsObj.spacing = numbers.SPACING_INSET_INPUT;
            }
        }

        return (
            <ConfigContext.Consumer>
                {({ timeZone }: { timeZone?: string | number }) => (
                    <LocaleConsumer componentName={'DatePicker'}>
                        {(locale: Locale['DatePicker'], localeCode: string, dateFnsLocale: Locale['dateFnsLocale']) => (
                            <DatePicker
                                timeZone={timeZone}
                                localeCode={localeCode}
                                locale={locale}
                                dateFnsLocale={dateFnsLocale}
                                {...propsObj}
                                ref={ref}
                            />
                        )}
                    </LocaleConsumer>
                )}
            </ConfigContext.Consumer>
        );
    }),
    DatePicker
);