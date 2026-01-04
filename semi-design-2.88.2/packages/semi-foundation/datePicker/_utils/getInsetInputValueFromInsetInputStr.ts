import { strings } from '../constants'; 

/**
 * 从 insetInputStr 字符串解析出 insetInputValue 对象
 * Parse the insetInputValue object from the insetInputStr string
 * 
 * @example
 * ```
 * '2022-02-01' => { monthLeft: { dateInput: '2022-02-01' } }
 * '2022-02-01 00:00:00' => { monthLeft: { dateInput: '2022-02-01', timeInput: '00:00:00' } }
 * '2022-02-01 00:00:00 ~ 2022-02-15 00:00:00' => { monthLeft: { dateInput: '2022-02-01', timeInput: '00:00:00'}, monthRight: { dateInput: '2022-02-15', timeInput: '00:00:00' } }
 * 
 * '2022-0' => { monthLeft: { dateInput: '2022-0' } }
 * '2022-02-01 00:00:' => { monthLeft: { dateInput: '2022-02-01', timeInput: '00:00:' } }
 * '2022-02-01 00:00:00 ~ ' => { monthLeft: { dateInput: '2022-02-01', timeInput: '00:00:00'}, monthRight: { dateInput: '', timeInput: '' } }
 * ' ~ 2022-02-15 00:00:00' => { monthLeft: { dateInput: '', timeInput: '' }, monthRight: { dateInput: '2022-02-15', timeInput: '00:00:00' } }
 * ```
 */
export default function getInsetInputValueFromInsetInputStr(options: { inputValue: string; rangeSeparator: string; type: typeof strings.TYPE_SET[number] }) {
    const timeSeparator = ' ';
    const { inputValue = '', rangeSeparator, type } = options;
    let leftDateInput, leftTimeInput, rightDateInput, rightTimeInput;
    const insetInputValue = {
        monthLeft: {
            dateInput: '',
            timeInput: '',
        },
        monthRight: {
            dateInput: '',
            timeInput: '',
        }
    };

    switch (type) {
        case 'date':
        case 'month':
        case 'monthRange':
            insetInputValue.monthLeft.dateInput = inputValue;
            break;
        case 'dateRange':
            [leftDateInput = '', rightDateInput = ''] = inputValue.split(rangeSeparator);
            insetInputValue.monthLeft.dateInput = leftDateInput;
            insetInputValue.monthRight.dateInput = rightDateInput;
            break;
        case 'dateTime':
            [leftDateInput = '', leftTimeInput = ''] = inputValue.split(timeSeparator);
            insetInputValue.monthLeft.dateInput = leftDateInput;
            insetInputValue.monthLeft.timeInput = leftTimeInput;
            break;
        case 'dateTimeRange':
            const [leftInput = '', rightInput = ''] = inputValue.split(rangeSeparator);
            [leftDateInput = '', leftTimeInput = ''] = leftInput.split(timeSeparator);
            [rightDateInput = '', rightTimeInput = ''] = rightInput.split(timeSeparator);
            insetInputValue.monthLeft.dateInput = leftDateInput;
            insetInputValue.monthLeft.timeInput = leftTimeInput;
            insetInputValue.monthRight.dateInput = rightDateInput;
            insetInputValue.monthRight.timeInput = rightTimeInput;
            break;
    }
    return insetInputValue;
}