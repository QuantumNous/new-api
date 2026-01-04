import { strings } from './constants';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import {
    formatToString,
    parseToDate,
    hourIsDisabled,
    minuteIsDisabled,
    secondIsDisabled,
    transformToArray,
    isTimeFormatLike
} from './utils';
import { split, isUndefined } from 'lodash';
import { isValid, format, getHours } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from '../utils/date-fns-extra';
import isNullOrUndefined from '../utils/isNullOrUndefined';

export type Position =
    | 'top'
    | 'topLeft'
    | 'topRight'
    | 'left'
    | 'leftTop'
    | 'leftBottom'
    | 'right'
    | 'rightTop'
    | 'rightBottom'
    | 'bottom'
    | 'bottomLeft'
    | 'bottomRight'
    | 'leftTopOver'
    | 'rightTopOver';

export interface TimePickerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    togglePanel: (show: boolean) => void;
    registerClickOutSide: () => void;
    setInputValue: (inputValue: string, cb?: () => void) => void;
    unregisterClickOutSide: () => void;
    notifyOpenChange: (open: boolean) => void;
    notifyChange(value: Date | Date[], input: string | string[]): void;
    notifyChange(input: string | string[], value: Date | Date[]): void;
    notifyFocus: (e: any) => void;
    notifyBlur: (e: any) => void;
    isRangePicker: () => boolean
}

// TODO: split, timePicker different components cannot share a foundation

class TimePickerFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<TimePickerAdapter<P, S>, P, S> {

    constructor(adapter: TimePickerAdapter<P, S>) {
        super({ ...adapter });
    }

    init() {
        this.initDataFromDefaultValue();

        const open = this._isControlledComponent('open') ? this.getProp('open') : this.getProp('defaultOpen');

        if (open && !this._isControlledComponent('open')) {
            this._adapter.registerClickOutSide();
        }
    }

    getPosition(): Position {
        const position = this.getProp('position');
        const type = this.getProp('type') || strings.DEFAULT_TYPE;
        // rtl change default position
        const direction = this.getContext('direction');
        const rtlDirection = direction === 'rtl' ? 'bottomRight' : '';
        return position || rtlDirection || strings.DEFAULT_POSITION[type];
    }

    isDisabledHMS({ hours, minutes, seconds }: { hours: number; minutes: number; seconds: number }) {
        const { disabledHours, disabledMinutes, disabledSeconds } = this.getProps();
        const hDis = !isNullOrUndefined(hours) && hourIsDisabled(disabledHours, hours);
        const mDis = !isNullOrUndefined(hours) && !isNullOrUndefined(minutes) && minuteIsDisabled(disabledMinutes, hours, minutes);
        const sDis =
            !isNullOrUndefined(hours) &&
            !isNullOrUndefined(minutes) &&
            !isNullOrUndefined(seconds) &&
            secondIsDisabled(disabledSeconds, hours, minutes, seconds);

        return hDis || mDis || sDis;
    }

    isValidTimeZone(timeZone: string | number) {
        return ['string', 'number'].includes(typeof timeZone) && timeZone !== '';
    }

    getDefaultFormatIfNeed(): string {
        if (this._isInProps('format')) {
            return this.getProp('format');
        } else if (this.getProp('use12Hours')) {
            return strings.DEFAULT_FORMAT_A;
        } else {
            return strings.DEFAULT_FORMAT;
        }
    }

    /**
     * User input value => save timestamp
     */
    initDataFromDefaultValue() {
        const defaultValue = this.getProp('defaultValue');
        let value = this.getProp('value');
        const timeZone = this.getProp('timeZone');
        const formatToken = this.getValidFormat();
        const { rangeSeparator, dateFnsLocale } = this.getProps();

        value = value || defaultValue;

        if (!Array.isArray(value)) {
            value = value ? [value] : [];
        }

        const parsedValues: Date[] = [];
        let invalid = false;
        (value as any[]).forEach(v => {
            const pv = parseToDate(v, formatToken, dateFnsLocale);
            if (!isNaN(pv.getTime())) {
                parsedValues.push(this.isValidTimeZone(timeZone) ? utcToZonedTime(pv, timeZone) : pv);
            }
        });

        const isAM = [true, false];
        parsedValues.map((item, idx)=>{
            isAM[idx]= getHours(item) < 12;
        });

        if (parsedValues.length === value.length) {
            value = parsedValues;
        } else {
            value = [];

            if (value.length) {
                invalid = true;
            }
        }

        let inputValue = '';

        if (!invalid) {
            inputValue = (value as any[]).map(v => formatToString(v, formatToken, dateFnsLocale)).join(rangeSeparator);
        }

        this.setState({
            isAM,
            value,
            inputValue,
            invalid,
        } as any);
    }

    getValidFormat(validFormat?: string) {
        let _format = validFormat;
        if (isNullOrUndefined(_format)) {
            _format = this.getDefaultFormatIfNeed();
        }
        if (typeof _format !== 'string') {
            _format = strings.DEFAULT_FORMAT;
        }
        return _format;
    }

    handlePanelChange(result: { isAM: boolean; value: string; timeStampValue: number }, index = 0) {
        // console.log(result, index);
        const formatToken = this.getValidFormat();
        const dateFnsLocale = this.getProp('dateFnsLocale');
        const oldValue: Date[] = this.getState('value');
        let isAM = this.getState('isAM');

        const value: Date[] = transformToArray(oldValue);
        isAM = transformToArray(isAM);

        if (result) {
            const panelIsAM = Boolean(result.isAM);
            const date = parseToDate(result.timeStampValue, formatToken, dateFnsLocale);
            value[index] = date;
            isAM[index] = panelIsAM;
            const inputValue = this.formatValue(value);

            if (this.getState('isAM')[index] !== result.isAM) {
                this.setState({ isAM } as any);
            }
            if (!this._isControlledComponent('value')) {
                const invalid = this.validateDates(value);
                this.setState({
                    isAM,
                    value,
                    inputValue,
                    invalid,
                } as any);
            }

            if (this._hasChanged(value, oldValue)) {
                this._notifyChange(value, inputValue);
            }
        }
    }

    refreshProps(props: any = {}) {
        const { value, timeZone, __prevTimeZone } = props;
        
        let dates = this.parseValue(value);

        let invalid = dates.some(d => isNaN(Number(d)));
        if (!invalid) {
            if (this.isValidTimeZone(timeZone)) {
                dates = dates.map(date =>
                    utcToZonedTime(
                        this.isValidTimeZone(__prevTimeZone) ? zonedTimeToUtc(date, __prevTimeZone) : date,
                        timeZone
                    )
                );
            }
            invalid = dates.some(d =>
                this.isDisabledHMS({ hours: d.getHours(), minutes: d.getMinutes(), seconds: d.getSeconds() })
            );
        }
        const inputValue = this.formatValue(dates);

        this.setState({
            value: dates,
            invalid,
            inputValue,
        } as any);
    }

    handleFocus(e: any) {
        if (!this.getState('open')) {
            this.handlePanelOpen();
        }
        this._adapter.notifyFocus(e);
    }

    setPanel(open: boolean) {
        this._adapter.togglePanel(open);
    }

    destroy() {
        this._adapter.unregisterClickOutSide();
    }

    handlePanelOpen() {
        if (!this._isControlledComponent('open')) {
            this._adapter.registerClickOutSide();
            this.setPanel(true);
        }
        this._adapter.notifyOpenChange(true);
    }

    handlePanelClose(clickedOutside: boolean, e: any) {
        if (!this._isControlledComponent('open')) {
            this._adapter.unregisterClickOutSide();
            this.setPanel(false);
        }
        this._adapter.notifyOpenChange(false);
        this._adapter.notifyBlur(e);
    }

    /* istanbul ignore next */
    handleVisibleChange(visible: boolean) {
        if (!this._isControlledComponent('open')) {
            this._adapter.togglePanel(visible);
        }
        this._adapter.notifyOpenChange(visible);
    }

    handleInputChange(input: string) {
        this._adapter.setInputValue(input);

        const rangeSeparator = this.getProp('rangeSeparator');
        const inputValues = split(input, rangeSeparator);
        const formatToken = this.getValidFormat();
        /**
         * 如果输入的字符串不是formatLike则不进行下一步操作，以免输入过程被打断
         * 特殊case
         *  - 清空时，input 为 ''，此时需要跳过isTimeFormatLike判断
         *
         * If the input string is not formatLike, do not proceed to the next operation to avoid interruption of the input process
         *  special case
         *  -when emptying, the input is "', at this time you need to skip isTimeFormatLike judgment
         */
        if (input !== '' && inputValues.some(time => !isTimeFormatLike(time, formatToken))) {
            return;
        }

        const dates = this.parseInput(input);
        const invalid = this.validateDates(dates);
        const states: { invalid: boolean; value?: Date[] } = { invalid };
        const oldValue = this.getState('value');
        let value = transformToArray(oldValue);

        if (!invalid) {
            states.value = dates;
            value = [...dates];
        }

        if (!this._isControlledComponent('value')) {
            this.setState(states as any);
        }

        if (this._hasChanged(value, oldValue)) {
            this._notifyChange(value, input);
        }
    }

    /* istanbul ignore next */
    doValidate(args: string | Array<Date>) {
        if (typeof args === 'string') {
            return this.validateStr(args);
        } else if (Array.isArray(args)) {
            return this.validateDates(args);
        }
        return undefined;
    }

    validateStr(inputValue = '') {
        const dates = this.parseInput(inputValue);
    
        return this.validateDates(dates);
    }

    validateDates(dates: Array<Date> = []) {
        let invalid = dates.some(d => isNaN(Number(d)));

        if (!invalid) {
            invalid = dates.some(d =>
                this.isDisabledHMS({ hours: d.getHours(), minutes: d.getMinutes(), seconds: d.getSeconds() })
            );
        }

        return invalid;
    }

    handleInputBlur(e: any) {
        const invalid = this.getState('invalid');
        const inputValue = this.getState('inputValue');
        const value = this.getState('value');

        if (inputValue) {
            if (invalid) {
                this.setState({
                    inputValue: this.formatValue(value),
                    invalid: false,
                } as any);
            } else {
                this.setState({
                    inputValue: this.formatValue(value),
                } as any);
            }
        } else {
            this.setState({
                inputValue: '',
                value: [],
                invalid: false,
            } as any);
        }
    }

    formatValue(dates: Date[]): string {
        const validFormat = this.getValidFormat();
        const rangeSeparator = this.getProp('rangeSeparator');
        const dateFnsLocale = this.getProp('dateFnsLocale');

        let _dates = dates;
        if (_dates && !Array.isArray(_dates)) {
            _dates = _dates[_dates];
        }

        if (_dates && Array.isArray(_dates)) {
            const result = _dates.map(date => {
                let str;
                if (isUndefined(date)) {
                    str = '';
                } else {
                    str = formatToString(date, validFormat, dateFnsLocale);
                }
                return str;
            });
            return result.join(rangeSeparator);
        }
        return undefined;
    }

    parseInput(str: string) {
        const validFormat = this.getValidFormat();
        const rangeSeparator = this.getProp('rangeSeparator');
        const dateFnsLocale = this.getProp('dateFnsLocale');

        if (str && typeof str === 'string') {
            return split(str, rangeSeparator).map(v => parseToDate(v, validFormat, dateFnsLocale));
        }

        return [];
    }

    parseValue(value: string | Date | Array<string | Date> = []) {
        const formatToken = this.getValidFormat();
        const dateFnsLocale = this.getProp('dateFnsLocale');

        let _value = value;
        if (!Array.isArray(_value)) {
            _value = _value ? [_value] : [];
        }

        if (Array.isArray(_value)) {
            return _value.map(v => parseToDate(v, formatToken, dateFnsLocale));
        }

        return [];
    }

    _notifyChange(value: Date[], inputValue: string) {
        let str: string | string[] = inputValue;
        let _value: Date | Date[] = value;
        const timeZone = this.getProp('timeZone');
        if (this._adapter.isRangePicker()) {
            const rangeSeparator = this.getProp('rangeSeparator');
            str = split(inputValue, rangeSeparator);
        } else {
            _value = Array.isArray(_value) ? _value[0] : _value;
        }

        if (this.isValidTimeZone(timeZone) && _value) {
            const formatToken = this.getValidFormat();
            if (Array.isArray(_value)) {
                _value = _value.map(v => zonedTimeToUtc(v, timeZone));
                str = _value.map(v => format(v, formatToken));
            } else {
                _value = zonedTimeToUtc(_value, timeZone);
                str = format(_value, formatToken);
            }
        }
        const onChangeWithDateFirst = this.getProp('onChangeWithDateFirst');
        if (onChangeWithDateFirst) {
            this._adapter.notifyChange(_value, str);
        } else {
            this._adapter.notifyChange(str, _value);
        }
    }

    _hasChanged(dates: Date[] = [], oldDates: Date[] = []) {
        const formatToken = this.getValidFormat();
        const dateFnsLocale = this.getProp('dateFnsLocale');

        return (
            dates.length !== oldDates.length ||
            dates.some((date, index) => {
                const oldDate = oldDates[index];

                if (
                    isValid(date) &&
                    isValid(oldDate) &&
                    formatToString(date, formatToken, dateFnsLocale) === formatToString(oldDate, formatToken, dateFnsLocale)
                ) {
                    return false;
                }

                return true;
            })
        );
    }
}

export default TimePickerFoundation;
