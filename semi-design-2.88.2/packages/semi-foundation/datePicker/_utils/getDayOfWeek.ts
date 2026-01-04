/**
 *
 * @param {number} weekStartsOn
 * the index of the first day of the week （0-Sunday，1-Monday, etc）
 *
 */

type WeekStartNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const getDayofWeek = ({ weekStartsOn = 0 }: { weekStartsOn: WeekStartNumber }) => {
    const weekDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let index = 0; index < weekStartsOn; index++) {
        weekDay.push(weekDay.shift());
    }
    return weekDay;
};
export default getDayofWeek;