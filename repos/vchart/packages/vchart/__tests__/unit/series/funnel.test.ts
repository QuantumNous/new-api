import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import type { ISeriesOption } from '../../../src/series/interface';
import { dimensionStatistics } from '../../../src/data/transforms/dimension-statistics';
import { initChartDataSet, seriesOption } from '../../util/context';
import { FunnelSeries } from '../../../src';
import { registerDataSetInstanceTransform } from '../../../src/data/register';
import { funnel } from '../../../src/data/transforms/funnel';
import {
  FUNNEL_CURRENT_VALUE,
  FUNNEL_REACH_RATIO,
  FUNNEL_TRANSFORM_RATIO,
  FUNNEL_HEIGHT_RATIO,
  FUNNEL_VALUE_RATIO,
  FUNNEL_NEXT_VALUE_RATIO,
  FUNNEL_LAST_VALUE_RATIO,
  FUNNEL_LAST_VALUE,
  FUNNEL_NEXT_VALUE,
  FUNNEL_TRANSFORM_LEVEL
} from '../../../src/constant/funnel';
import { get } from '@visactor/vutils';
import { DEFAULT_DATA_INDEX } from '../../../src/constant/data';
const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
dataSet.registerTransform('dimensionStatistics', dimensionStatistics);
const dataView = new DataView(dataSet);
const data = `name,value
1,1000
2,840
3,null
4,570
5,370`;
dataView.parse(data, {
  type: 'csv'
});

let ctx: ISeriesOption;
describe('[Domain-Series-Funnel] Funnel Series', () => {
  beforeEach(() => {
    ctx = seriesOption({ dataSet });
  });

  test('funnel series init', () => {
    const funnel = new FunnelSeries<any>({}, ctx);
    funnel.init({});
  });

  test('funnel series mark', () => {
    const funnel = new FunnelSeries<any>(
      {
        data: dataView,
        categoryField: 'name',
        valueField: 'value'
      },
      ctx
    );
    funnel.created();
    funnel.init({});

    const marks = funnel.getMarks();
    expect(marks.length).toEqual(2);

    const funnelPolygon = marks[1];
    expect(funnelPolygon.type).toEqual('polygon');
    expect(funnelPolygon.name).toEqual('funnel');
  });

  test('funnel data transform', () => {
    registerDataSetInstanceTransform(dataView.dataSet, 'funnel', funnel);
    const data = dataView.transform({
      type: 'funnel',
      options: {
        valueField: 'value',
        isCone: true,
        asCurrentValue: FUNNEL_CURRENT_VALUE,
        asTransformRatio: FUNNEL_TRANSFORM_RATIO,
        asReachRatio: FUNNEL_REACH_RATIO,
        asHeightRatio: FUNNEL_HEIGHT_RATIO,
        asValueRatio: FUNNEL_VALUE_RATIO,
        asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
        asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
        asLastValue: FUNNEL_LAST_VALUE,
        asNextValue: FUNNEL_NEXT_VALUE
      }
    });
    const first = data.latestData[0];
    const last = data.latestData[4];
    expect(first[FUNNEL_CURRENT_VALUE]).toBe(1000);
    expect(first[FUNNEL_REACH_RATIO]).toBe(1);
    expect(first[FUNNEL_TRANSFORM_RATIO]).toBe(0.84);
    expect(first[FUNNEL_HEIGHT_RATIO]).toBe(0.2);

    expect(last[FUNNEL_CURRENT_VALUE]).toBe(370);
    expect(last[FUNNEL_REACH_RATIO]).toBe(370 / 570);
    expect(last[FUNNEL_NEXT_VALUE_RATIO]).toBe(0);
    expect(last[FUNNEL_TRANSFORM_RATIO]).toBe(0);
    expect(last[FUNNEL_LAST_VALUE_RATIO]).toBe(0.57);
    expect(last[FUNNEL_VALUE_RATIO]).toBe(0.37);
  });

  test('funnel series', () => {
    const funnel = new FunnelSeries<any>(
      {
        data: dataView,
        maxSize: 400,
        categoryField: 'name',
        valueField: 'value',
        shape: 'rect',
        isTransform: true,
        label: { visible: true },
        outerLabel: { visible: true },
        transformLabel: { visible: true }
      },
      ctx
    );
    funnel.created();
    funnel.init({});
    funnel.fillData();

    const marks = funnel.getMarks();
    expect(marks.length).toEqual(5);

    const funnelPolygon = marks[1];
    expect(funnelPolygon.type).toEqual('polygon');
    expect(funnelPolygon.name).toEqual('funnel');
    expect(get(funnelPolygon.stateStyle.normal, 'visible.style')({ value: null })).toEqual(false);
    expect(get(funnelPolygon.stateStyle.normal, 'visible.style')({ value: 1 })).toEqual(true);

    const funnelData0 = funnel.getViewData()?.latestData?.[0];
    const transformData0 = (funnel as any)._viewDataTransform.getLatestData()?.[0];
    const testParams = { mark: { name: 'transform' } } as any;

    // tooltip title
    expect(funnel.tooltipHelper?.dimensionTooltipTitleCallback(transformData0, testParams)).toBe('转化率');
    expect(funnel.tooltipHelper?.dimensionTooltipTitleCallback(funnelData0)).toBe(
      funnelData0[funnel.getCategoryField()]
    );
    // tooltip content value
    expect(funnel.tooltipHelper?.markTooltipValueCallback(transformData0, testParams)).toBe('84.0%');
    expect(funnel.tooltipHelper?.markTooltipValueCallback(funnelData0)).toBe(funnelData0[funnel.getValueField()]);
    // tooltip content key
    expect(funnel.tooltipHelper?.markTooltipKeyCallback(transformData0, testParams)).toBe('转化率');
    expect(funnel.tooltipHelper?.markTooltipKeyCallback(funnelData0)).toBe(funnelData0[funnel.getCategoryField()]);

    // getPoints;
    funnel.setLayoutRect({ width: 500, height: 500 });
    funnel.getLayoutRect = () => {
      return { width: 500, height: 500 };
    };
    // maxSize
    expect(funnel.getPoints(funnelData0)[0].x).toBe(50);

    (funnel as any)._funnelAlign = 'left';
    expect(funnel.getPoints(funnelData0)[0].x).toBe(0);
    expect(funnel.getPoints(funnelData0)[1].x).toBe(400);

    (funnel as any)._funnelOrient = 'left';
    funnel.getSpec().gap = 10;
    funnelData0[DEFAULT_DATA_INDEX] = 0;
    funnelData0[FUNNEL_TRANSFORM_LEVEL] = true;
    expect(get(funnelPolygon.stateStyle.normal, 'points.style')(funnelData0)[0].y).toBe(400);
  });
});
