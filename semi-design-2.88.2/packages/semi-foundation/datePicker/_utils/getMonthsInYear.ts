const getMonthsInYear = (year: number) => Array.from({ length: 12 }, (v, i) => `${year}-${i + 1}`);
export default getMonthsInYear;