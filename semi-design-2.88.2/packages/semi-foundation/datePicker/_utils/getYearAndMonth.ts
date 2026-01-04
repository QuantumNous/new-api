export default function getYearAndMonth(year: { left: number; right: number }, month: { left: number; right: number }) {
    const nowYear = new Date().getFullYear();
    const nowMonth = new Date().getMonth();

    const rightMonth = month.right || (nowMonth + 2);
    const rightYear = year.right || (rightMonth <= 12 ? nowYear : nowYear + 1);

    return {
        year: { left: year.left || nowYear, right: rightYear },
        month: { left: month.left || nowMonth + 1, right: rightMonth <= 12 ? rightMonth : 1 },
    };
}