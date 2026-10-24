import type { IMark } from '../../mark/interface';
import { SeriesMarkNameEnum } from '../../series/interface/type';

export const modifyOuterLabels = (marks: IMark[]) => {
  const outerMarks = marks.filter(
    mark => mark.name === SeriesMarkNameEnum.outerLabel || mark.name === SeriesMarkNameEnum.outerLabelLine
  );

  outerMarks.forEach(m => {
    marks.splice(marks.indexOf(m), 1);
    marks.push(m);
  });
};
