import { Page01OriginalData, Page01YearMap } from './interface';

export const getPage01YearMap = (data: Page01OriginalData): Page01YearMap => {
  const yearMap: Page01YearMap = {};
  (['boy', 'girl'] as (keyof Page01OriginalData)[]).forEach(sex => {
    data[sex].forEach(item => {
      if (!yearMap[item.year]) {
        yearMap[item.year] = {
          year: item.year
        };
      }
      yearMap[item.year][sex] = item;
    });
  });
  return yearMap;
};
