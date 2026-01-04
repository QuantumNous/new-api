/**
 *
 * @param {string} month
 */
import {
    startOfMonth,
    lastDayOfMonth,
    getDaysInMonth,
    // getDay,
    // parseISO,
    format
} from 'date-fns';

function formatFullDate(year: number | string = '', month: number | string = '', day: number | string = ''): string {
    let dateStr = '';
    const monthFull = typeof month === 'number' && month < 10 ? `0${ month}` : month.toString();
    const dayNumberFull = typeof day === 'number' && day < 10 ? `0${ day}` : day.toString();
    dateStr = `${String(year) }-${ monthFull }-${ dayNumberFull}`;
    return dateStr;
}

/**
 * [getWeeks description]
 */
export type WeekStartNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;
function getWeeks(date: Date, weekStartsOn: WeekStartNumber = 0) {
    const weekDayNotInMonth = {
        dayNumber: '',
        dateNumberFull: '',
        fullDate: '',
    }; // For the first or last week epmtyDays
    const daysInMonth = getDaysInMonth(date); // Get the total number of days in the month
    const year = format(date, 'yyyy');
    const month = format(date, 'MM');
    const lastday = lastDayOfMonth(date); // Get the last day of the month
    const firstDay = startOfMonth(date); // Get the first day of the month
    // Const firstDayInWeek = getDay (firstDay);//The first day belongs to the day of the week
    // What is the first day of the month in the first row?
    const firstDayInWeek = Number(format(firstDay, 'e', { weekStartsOn }));

    const weeks = [];
    let week = [];
    // add empty days to set first day in correct position
    for (let s = 1; s < firstDayInWeek; s++) {
        week.push(weekDayNotInMonth);
    }

    for (let d = 0; d < daysInMonth; d++) {
        const dayNumber = d + 1;
        const dayNumberFull = dayNumber < 10 ? `0${ dayNumber}` : dayNumber.toString();
        const fullDate = formatFullDate(year, month, dayNumber);

        week.push({
            dayNumber,
            dayNumberFull,
            fullDate,
        });

        if (week.length === 7) {
            weeks.push(week);
            week = [];
        } else if (fullDate === format(lastday, 'yyyy-MM-dd')) {
            // Last week alone
            weeks.push(week);
            week = [];
        }
    }
    return weeks;
}

const getMonthTable = (month: Date, weekStartsOn: WeekStartNumber) => {
    const weeks = getWeeks(month, weekStartsOn);
    const monthText = format(month, 'yyyy-MM');
    return { monthText, weeks, month };
};

export default getMonthTable;

export { formatFullDate };
