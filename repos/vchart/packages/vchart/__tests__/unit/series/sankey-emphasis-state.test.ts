// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import VChart from '../../../src';
import { Event_Bubble_Level } from '../../../src/constant/event';
import { findMarkGraphic } from '../../../src/util/mark';
import { createDiv, removeDom } from '../../util/dom';

const createSpec = () => ({
  type: 'sankey',
  width: 500,
  height: 300,
  data: [
    {
      values: [
        {
          nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
          links: [
            { source: 'A', target: 'B', value: 10, color: '#dddddd' },
            { source: 'C', target: 'B', value: 5, color: '#dddddd' },
            { source: 'B', target: 'D', value: 8, color: 'orange' }
          ]
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',
  nodeAlign: 'justify',
  nodeGap: 8,
  nodeWidth: 15,
  minNodeHeight: 4,
  nodeKey: datum => datum.name,
  iterations: 20,
  node: {
    style: {
      fill: '#b9b9b9'
    },
    state: {
      selected: {
        fill: '#dddddd',
        fillOpacity: 1
      },
      blur: {
        fillOpacity: 0.05
      }
    }
  },
  link: {
    style: {
      fill: data => data.color ?? data.datum?.color,
      fillOpacity: 1
    },
    state: {
      selected: {
        fillOpacity: 1
      },
      blur: {
        fillOpacity: 0.05
      }
    }
  },
  emphasis: {
    enable: true,
    effect: 'adjacency'
  }
});

describe('sankey emphasis state', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let chart: VChart;

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
    container.style.position = 'fixed';
    container.style.width = '500px';
    container.style.height = '300px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    chart?.release();
    removeDom(container);
  });

  test('link sub graphic click should apply blur opacity to non-adjacent links', () => {
    chart = new VChart(createSpec(), {
      dom,
      animation: false
    });
    chart.renderSync();

    const series = chart.getChart().getAllSeries()[0] as any;
    const linkMark = series._linkMark;
    const links = linkMark.getGraphics();
    const clicked = links[2];
    const other = links[0];
    const eventTarget = clicked.getSubGraphic()[0];
    const item = findMarkGraphic(chart.getCompiler().getRootGroup(), eventTarget);
    const mark = chart.getChart().getMarkById(item.context.markId);

    series.event.emit(
      'pointerdown',
      {
        item,
        mark
      },
      Event_Bubble_Level.chart
    );

    expect(item).toBe(clicked);
    expect(mark).toBe(linkMark);
    expect(other.currentStates).toContain('blur');
    expect(other.attribute.fillOpacity).toBe(0.05);
    expect(other.getSubGraphic()[0].attribute.fillOpacity).toBe(0.05);
    expect(other.getSubGraphic()[1].attribute.fillOpacity).toBe(0.05);
  });
});
