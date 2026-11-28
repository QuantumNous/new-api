import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import type { ISeriesOption } from '../../../src/series/interface';
import { dimensionStatistics } from '../../../src/data/transforms/dimension-statistics';
import { initChartDataSet, markContext, seriesOption } from '../../util/context';
import * as bt from '../../../src/vchart-all';
import { get } from '../../../src/util/object';
import { WordCloudSeries } from '../../../src/series/word-cloud/word-cloud';
import { TextMark } from '../../../src/mark/text';
bt;
const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
dataSet.registerTransform('dimensionStatistics', dimensionStatistics);
const dataView = new DataView(dataSet);
const data = `text,size,index
foo,49,0
bar,36,1
baz,25,2
abc,1,3
5,5,670`;

dataView.parse(data, {
  type: 'csv'
});

const spec = {
  type: 'wordCloud',
  width: 500,
  height: 500,
  data: dataView,
  nameField: 'text',
  valueField: 'size',
  word: {
    style: {
      textAlign: 'left',
      textBaseline: 'top'
    }
  }
};

let ctx: ISeriesOption;
describe('[Domain-Series-WordCloud] WordCloud Series', () => {
  beforeEach(() => {
    ctx = seriesOption({ dataSet });
    // TODO
    // ctx = {
    //   region: { interaction: { registerMark() {} } } as any,
    //   eventDispatcher: new EventDispatcher({} as any, { addEventListener: () => {} } as any),
    //   render: {} as any,
    //   dataSet,
    //   map: new Map(),
    //   mode: 'desktop-browser',
    //   getCompiler: (key: string, opt: any) => {
    //     return {} as any;
    //   },
    //   theme: ThemeLibrary.curTheme,
    //   globalScale: {},
    //   getChartLayoutRect: () => {
    //     return { width: 0, height: 0 };
    //   }
    // } as ISeriesOption;
  });

  test('wordCloud  series init', () => {
    const wordCloud = new WordCloudSeries<any>({}, ctx);
    wordCloud.init({});
  });

  test('wordCloud series mark', () => {
    const wordCloud = new WordCloudSeries<any>(spec, ctx);
    wordCloud.created();
    wordCloud.init({});

    let marks = wordCloud.getMarks();
    expect(marks.length).toEqual(2);

    let wordMark = marks[1];
    const markId = wordMark.id;
    expect(get(wordMark.stateStyle.normal, 'textAlign.style')).toBe('left');
    expect(get(wordMark.stateStyle.normal, 'textBaseline.style')).toBe('top');

    // add
    const addMark = new TextMark('testText', markContext);
    wordCloud.getMarkSet().addMark(addMark);

    marks = wordCloud.getMarks();
    expect(marks.length).toEqual(3);
    wordMark = marks[2];
    expect(wordMark.name).toEqual('testText');
    expect(wordMark.type).toEqual('text');

    wordCloud.getMarkSet().removeMark(addMark.name);
    marks = wordCloud.getMarks();
    expect(marks.length).toEqual(2);
    wordMark = marks[1];
    expect(wordMark.id).toEqual(markId);
  });
});
