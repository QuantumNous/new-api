import { DataSet, csvParser } from '@visactor/vdataset';
import type { ISeriesOption } from '../../../src/series/interface';
import { initChartDataSet, seriesOption } from '../../util/context';
import { LinearProgressSeries } from '../../../src';

const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
let ctx: ISeriesOption;
describe('[Domain-Series-LinearProgress] LinearProgress Series', () => {
  beforeEach(() => {
    ctx = seriesOption({ dataSet });
  });

  test('linearProgress series init', () => {
    const linearProgress = new LinearProgressSeries<any>({}, ctx);
    linearProgress.init({});
  });

  test('linearProgress series mark', () => {
    const linearProgress = new LinearProgressSeries<any>({}, ctx);
    linearProgress.created();
    linearProgress.init({});

    const marks = linearProgress.getMarks();
    expect(marks.length).toEqual(3);

    const backgroundMark = marks[1];
    expect(backgroundMark.type).toEqual('rect');
    expect(backgroundMark.name).toEqual('track');

    const progressMark = marks[2];
    expect(progressMark.type).toEqual('rect');
    expect(progressMark.name).toEqual('progress');
  });
});
