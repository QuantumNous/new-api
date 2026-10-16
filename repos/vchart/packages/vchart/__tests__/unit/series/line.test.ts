import { SymbolMark } from '../../../src/mark/symbol';
import { DataSet, DataView, csvParser, dataViewParser } from '@visactor/vdataset';
import type { ISeriesOption } from '../../../src/series/interface';
import { LineSeries } from '../../../src/series/line/line';
import { dimensionStatistics } from '../../../src/data/transforms/dimension-statistics';
import { initChartDataSet, markContext, seriesOption } from '../../util/context';
import * as bt from '../../../src/vchart-all';
import { get } from '../../../src/util/object';
bt;
const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
dataSet.registerTransform('dimensionStatistics', dimensionStatistics);
const dataView = new DataView(dataSet);
const data = `x,type,y
1,1,850
2,2,740
3,3,900
4,4,570
5,5,670`;
dataView.parse(data, {
  type: 'csv'
});

let ctx: ISeriesOption;
describe('[Domain-Series-Line] Line Series', () => {
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

  test('line  series init', () => {
    const line = new LineSeries<any>({}, ctx);
    line.init({});
  });

  test('line  series mark', () => {
    const line = new LineSeries<any>(
      {
        data: dataView,
        xField: 'x',
        yField: 'x',
        line: {
          style: {
            interpolate: 'basis',
            strokeWidth: 2,
            stroke: {
              gradient: 'linear',
              x0: 0,
              y0: 0.5,
              x1: 1,
              y1: 0.5,
              stops: [
                {
                  offset: 0,
                  color: (data: any) => {
                    if (data.c === 0) {
                      return '#009800';
                    }
                    return '#000098';
                  },
                  opacity: 0
                },
                {
                  offset: 0.5,
                  color: (data: any) => {
                    if (data.c === 0) {
                      return '#1d983a';
                    }
                    return '#1d3a98';
                  },
                  opacity: 0.5
                },
                {
                  offset: 1,
                  color: (data: any) => {
                    if (data.c === 0) {
                      return '#4d98ca';
                    }
                    return '#4dca98';
                  },
                  opacity: 1
                }
              ]
            }
          }
        }
      },
      ctx
    );
    line.created();
    line.init({});

    let marks = line.getMarks();
    expect(marks.length).toEqual(3);

    const lineMark = marks[1];
    expect(get(lineMark.stateStyle.normal, 'stroke.style.gradient')).toBe('linear');
    expect(get(lineMark.stateStyle.normal, 'stroke.style.stops')).not.toBeUndefined();

    let symbolMark = marks[2];
    const markId = symbolMark.id;
    expect(symbolMark.getProductId()).toEqual(`point_${symbolMark.id}`);
    expect(symbolMark.name).toEqual('point');
    expect(symbolMark.type).toEqual('symbol');

    // add
    const addMark = new SymbolMark('testSymbol', markContext);
    line.getMarkSet().addMark(addMark);

    marks = line.getMarks();
    expect(marks.length).toEqual(4);
    symbolMark = marks[3];
    expect(symbolMark.name).toEqual('testSymbol');
    expect(symbolMark.type).toEqual('symbol');

    line.getMarkSet().removeMark(addMark.name);
    marks = line.getMarks();
    expect(marks.length).toEqual(3);
    symbolMark = marks[2];
    expect(symbolMark.id).toEqual(markId);
  });
});
