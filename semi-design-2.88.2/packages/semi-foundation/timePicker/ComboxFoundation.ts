import { strings } from './constants';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { isValidDate } from '../datePicker/_utils/index';
import isNullOrUndefined from '../utils/isNullOrUndefined';

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;
// TODO: move to utils
export const formatOption = (option: number, disabledOptions: number[]) => {
    let value = `${option}`;
    if (option < 10) {
        value = `0${option}`;
    }

    let disabled = false;
    if (disabledOptions && disabledOptions.indexOf(option) >= 0) {
        disabled = true;
    }

    return {
        value,
        disabled,
    };
};

function generateOptions(length: number, disabledOptions: number[], hideDisabledOptions: boolean, step = 1) {
    const arr = [];
    for (let value = 0; value < length; value += step) {
        if (!disabledOptions || disabledOptions.indexOf(value) < 0 || !hideDisabledOptions) {
            arr.push(value);
        }
    }
    return arr;
}

class ComboboxFoundation extends BaseFoundation<DefaultAdapter> {

    constructor(adapter: DefaultAdapter) {
        super({ ...adapter });
    }

    isAM() {
        return this.getProp('isAM');
    }

    initData() {
        const {
            timeStampValue,
            hourStep,
            disabledMinutes,
            disabledSeconds,
            hideDisabledOptions,
            minuteStep,
            secondStep,
        } = this.getProps();

        const format = this.getValidFormat();

        const dateTime = this.getDisplayDateFromTimeStamp(timeStampValue);

        const disabledHourOptions = this.disabledHours();
        const disabledMinuteOptions = disabledMinutes(dateTime ? dateTime.getHours() : null);
        const disabledSecondOptions = disabledSeconds(
            dateTime ? dateTime.getHours() : null,
            dateTime ? dateTime.getMinutes() : null
        );
        const hourOptions = generateOptions(24, disabledHourOptions, hideDisabledOptions, hourStep);
        const minuteOptions = generateOptions(60, disabledMinuteOptions, hideDisabledOptions, minuteStep);
        const secondOptions = generateOptions(60, disabledSecondOptions, hideDisabledOptions, secondStep);

        return {
            showHour: Boolean(format.match(/HH|hh|H|h/g)),
            showMinute: Boolean(format.match(/mm/g)),
            showSecond: Boolean(format.match(/ss/g)),
            hourOptions,
            minuteOptions,
            secondOptions,
        };
    }

    getPosition() {
        const position = this.getProp('position');
        const type = this.getProp('type') || strings.DEFAULT_TYPE;

        return position || strings.DEFAULT_POSITION[type];
    }

    getDefaultFormatIfNeed() {
        if (this._isInProps('format')) {
            return this.getProp('format');
        } else if (this.getProp('use12Hours')) {
            return strings.DEFAULT_FORMAT_A;
        } else {
            return strings.DEFAULT_FORMAT;
        }
    }

    disabledHours(): number[] {
        const { use12Hours, disabledHours } = this.getProps();
        let disabledOptions = disabledHours && disabledHours();

        if (use12Hours && Array.isArray(disabledOptions)) {
            if (this.isAM()) {
                disabledOptions = disabledOptions.filter(h => h < 12).map(h => (h === 0 ? 12 : h));
            } else {
                disabledOptions = disabledOptions.map(h => (h === 12 ? 12 : h - 12));
            }
        }
        return disabledOptions;
    }

    getValidFormat(format?: string): string {
        let _format = isNullOrUndefined(format) ? this.getProp('format') : format;
        _format = this.getDefaultFormatIfNeed();
        _format = typeof _format === 'string' ? _format : strings.DEFAULT_FORMAT;

        // if (use12Hours) {
        //     format = format.replace(/H/g, 'h');

        //     if (!/(\s+)a/i.test(format)) {
        //         format += ' a';
        //     } else {
        //         format = format.replace(/(\s+)A/i, '$1a');
        //     }
        // }
        return _format;
    }

    /**
     * from 13-bit timestamp  -> get display date
     * by combobox use
     */
    getDisplayDateFromTimeStamp(timeStamp: Date | string) {
        let date;
        if (timeStamp) {
            date = new Date(timeStamp);
        }
        if (!timeStamp || !isValidDate(date)) {
            return this.createDateDefault();
        }
        return date;
    }
    /**
     * create a date at 00:00:00
     */

    createDateDefault() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
}

export default ComboboxFoundation;
