import { useCallback, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BarChart,
  AreaChart,
  LineChart,
  ScatterChart,
  PieChart,
  RoseChart,
  RadarChart,
  FunnelChart,
  CircularProgressChart,
  LinearProgressChart,
  RangeColumnChart,
  BoxPlotChart,
  Bar,
  Axis,
  Mark,
  VChart,
  Legend,
  Tooltip,
  ITooltipRenderProps,
  ILineChartSpec,
  Funnel,
  CommonChart,
  Line
} from '../../src';
import './App.css';
import { generateData } from './util';
import Switch from './Switch';

const data = generateData(
  [
    { key: 'type', values: ['A', 'B'] },
    { key: 'gender', values: ['female', 'male'] }
  ],
  10
);

const lineData = generateData([{ key: 'type', values: ['A', 'B', 'C'] }], 20);
const simpleData = [
  {
    id: 'id0',
    values: [
      { x: 'A', y: 0.2 },
      { x: 'B', y: 0.25 },
      { x: 'C', y: 0.35 }
    ]
  }
];

function App() {
  const [count, setCount] = useState(0);
  const [markFill, setMarkFill] = useState('red');
  const [barData, setBarData] = useState(
    generateData(
      [
        { key: 'type', values: ['A', 'B'] },
        { key: 'gender', values: ['female', 'male'] }
      ],
      10
    )
  );
  const handleUpdateMark = () => {
    if (markFill === 'red') {
      setMarkFill('green');
    } else {
      setMarkFill('red');
    }
  };
  const handleClick = () => {
    setBarData(
      generateData(
        [
          { key: 'type', values: ['A', 'B'] },
          { key: 'gender', values: ['female', 'male'] }
        ],
        10
      )
    );
  };

  const handleReady = useCallback(chartInstance => {
    (window as any).vchart = chartInstance;
  }, []);

  const handleChartClick = (a: any) => {
    console.log('chart, click');
    console.log(a);

    console.log('chartRef', chartRef);
  };

  const handleBarClick = (a: any) => {
    console.log('bar click');
    console.log(a);
  };

  const handleLegendItemClick = (a: any) => {
    console.log('legend item click');
    console.log(a);
  };

  const chartRef = useRef(null);
  const [xAxisPosition, setXAxisPosition] = useState('bottom');

  const renderFunnelLabel = useCallback(datum => {
    console.log(datum);
    return {
      element: (
        <p style={{ color: 'black' }}>
          <span>teststst</span>
          {datum.x}
        </p>
      ),
      anchorType: 'top-right'
      // style: {
      //   width: '100%',
      //   height: '100%'
      // }
    };
  }, []);

  return (
    <div className="App">
      <button onClick={handleClick}>更新柱图数据</button>
      <button onClick={handleUpdateMark}>更新mark属性</button>
      {/* <BarChart
        ref={chartRef}
        data={[{ id: 'id0', values: barData }]}
        onClick={handleChartClick}
        onLegendItemClick={handleLegendItemClick}
        onReady={(...d) => {
          console.log(d);
        }}
        // axes={[
        //   { orient: "bottom", type: "band" },
        //   { orient: "left", label: { visible: true }, type: "linear" },
        // ]}
      >
        <Bar
          seriesField="gender"
          xField={['x', 'type']}
          yField="y"
          bar={{
            style: {
              stroke: 'orange',
              strokeWidth: 2
            },
            state: {
              hover: {
                fill: 'black'
              }
            }
          }}
          onClick={handleBarClick}
        />
        <Axis orient="bottom" type="band" />
        <Axis orient="left" label={{ visible: true }} type="linear" />
        <Mark
          type="symbol"
          zIndex={1000}
          encode={{
            update: {
              symbolType: 'circle',
              size: 30,
              x: 100,
              y: 100,
              fill: markFill,
              stroke: 'pink',
              lineWidth: 2
            }
          }}
        />
        <Legend visible={true} onLegendItemClick={handleLegendItemClick} />
        <Tooltip reserveDefaultTooltip>🔥</Tooltip>
      </BarChart>

      <AreaChart
        data={[{ id: 'id0', values: barData }]}
        xField={['x', 'type']}
        yField="y"
        tooltipRender={(el, actualTooltip) => (
          <div style={{ color: 'red', padding: 5 }}>🔥 {actualTooltip.title.value}</div>
        )}
      >
        <Axis orient="bottom" type="band" />
        <Axis orient="left" label={{ visible: true }} type="linear" />
        <Legend visible={true} />
      </AreaChart>

      <LineChart data={[{ id: 'id0', values: barData }]} xField={['x', 'type']} yField="y">
        <Axis orient="bottom" type="band" />
        <Axis orient="left" label={{ visible: true }} type="linear" />
        <Legend visible={true} />
        <Tooltip
          tooltipRender={(el, actualTooltip) => (
            <div style={{ color: 'red', padding: 5, width: 300 }}>🔥 {actualTooltip.title.value}</div>
          )}
        />
      </LineChart>

      <PieChart data={simpleData} valueField={'y'} categoryField={'x'}>
        <Legend visible={true} />
        <Tooltip>
          <TestTooltip />
        </Tooltip>
      </PieChart>

      <ScatterChart data={[{ id: 'id0', values: barData }]} xField={['x', 'type']} yField="y">
        <Axis orient="bottom" type="band" />
        <Axis orient="left" label={{ visible: true }} type="linear" />
        <Legend visible={true} />
      </ScatterChart>

      <RoseChart data={simpleData} valueField={'y'} categoryField={'x'} seriesField={'x'}>
        <Legend visible={true} />
      </RoseChart>

      <RadarChart data={simpleData} valueField={'y'} categoryField={'x'}>
        <Legend visible={true} />
      </RadarChart> */}

      <FunnelChart data={simpleData} options={{ ReactDOM }} onReady={handleReady}>
        <Legend visible={true} />
        <Funnel
          id="funnel"
          categoryField={'x'}
          valueField={'y'}
          funnel={{
            style: {
              stroke: '#000',
              lineWidth: 2,
              react: renderFunnelLabel
            }
          }}
        />
      </FunnelChart>

      <CommonChart
        seriesField="color"
        data={[
          {
            id: 'id0',
            values: [
              { x: 'Monday', y: 15 },
              { x: 'Tuesday', y: 12 },
              { x: 'Wednesday', y: 15 },
              { x: 'Thursday', y: 10 },
              { x: 'Friday', y: 13 },
              { x: 'Saturday', y: 10 },
              { x: 'Sunday', y: 20 }
            ]
          },
          {
            id: 'id1',
            values: [
              { x: 'Monday', y: -52 },
              { x: 'Tuesday', y: -43 },
              { x: 'Wednesday', y: -33 },
              { x: 'Thursday', y: -22 },
              { x: 'Friday', y: -10 },
              { x: 'Saturday', y: -30 },
              { x: 'Sunday', y: -50 }
            ]
          }
        ]}
      >
        <Bar id="bar" dataIndex={0} stack={false} label={{ visible: true }} xField="x" yField="y" />
        <Line
          id="line"
          dataIndex={1}
          label={{ visible: true }}
          seriesField="type"
          xField="x"
          yField="y"
          stack={false}
        />
        <Axis orient="left" seriesIndex={[0]} id="axisLeft" nice={false} zero={false} />
        <Axis
          orient="right"
          seriesId={['line']}
          grid={{ visible: false }}
          sync={{ axisId: 'axisLeft', tickAlign: true }}
          nice={false}
          zero={false}
        />
        <Axis orient="bottom" label={{ visible: true }} type="band" />
      </CommonChart>

      {/* <WordCloudChart data={simpleData} nameField={'x'} valueField={'y'}>
        <Legend visible={true} />
      </WordCloudChart> */}

      {/* <CircularProgressChart data={simpleData} valueField={'y'} seriesField={'x'}>
        <Legend visible={true} />
      </CircularProgressChart>

      <LinearProgressChart data={simpleData} xField={'y'} yField={'x'} />

      <RangeColumnChart
        data={[
          {
            id: 'data0',
            values: [
              { type: '分类一', min: 76, max: 100 },
              { type: '分类二', min: 56, max: 108 },
              { type: '分类三', min: 38, max: 129 },
              { type: '分类四', min: 58, max: 155 },
              { type: '分类五', min: 45, max: 120 },
              { type: '分类六', min: 23, max: 99 },
              { type: '分类七', min: 18, max: 56 },
              { type: '分类八', min: 18, max: 34 }
            ]
          }
        ]}
        xField={'type'}
        minField={'min'}
        maxField={'max'}
      /> */}

      {/* <BoxPlotChart
        data={[
          {
            name: 'boxPlot',
            values: [
              {
                x: 'group1',
                y1: 1600,
                y2: 1200,
                y3: 800,
                y4: 700,
                y5: 500,
                outliers: [2000, 2200]
              },
              {
                x: 'group2',
                y1: 1900,
                y2: 1000,
                y3: 400,
                y4: 300,
                y5: 100,
                outliers: [2500]
              },
              {
                x: 'group3',
                y1: 1300,
                y2: 1200,
                y3: 200,
                y4: -100,
                y5: -500,
                outliers: [-1000, 1800, 2300]
              }
            ]
          }
        ]}
        xField={'x'}
        minField={'y5'}
        maxField={'y1'}
        q1Field={'y4'}
        medianField={'y3'}
        q3Field={'y2'}
        outliersField={'outliers'}
        direction={'vertical'}
      /> */}

      <VChart
        onClick={handleChartClick}
        options={{ ReactDOM }}
        spec={
          {
            type: 'line',

            data: [
              {
                id: 'id0',
                values: lineData
              }
            ],
            xField: 'x',
            yField: 'y',
            seriesField: 'type',
            label: { visible: true },
            legends: { visible: true },
            point: {
              state: {
                hover: {
                  size: 20,
                  fill: 'red'
                }
              }
            },
            axes: [
              {
                orient: 'left',
                tickCount: 6,
                forceTickCount: 6,
                visible: true
              },
              {
                orient: 'bottom',
                label: { visible: true }
              }
            ],
            tooltip: {
              dimension: {
                hasShape: false,
                content: [
                  {
                    hasShape: true,
                    value: (datum: any) => datum.y
                  },
                  {
                    value: 'test'
                  }
                ]
              },
              mark: {
                position: 'top'
              }
              //renderMode: 'canvas'
            },
            customMark: [
              {
                type: 'rect',
                layoutType: 'region-relative',
                orient: 'top',
                height: 20,
                visible: true,
                zIndex: 10001,
                style: {
                  react: {
                    id: 'yAxisSwitch',
                    element: <p style={{ margin: 0, color: 'black' }}>classs</p>
                  },
                  fill: 'red',
                  x: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);
                    // return (bounds.x1 + bounds.x2) / 2;
                    return bounds.x1;
                  },

                  y: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);

                    return bounds.y1;
                  },
                  width: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);

                    return bounds.width();
                  },
                  height: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);

                    return bounds.height();
                  }
                }
              },
              {
                type: 'rect',
                layoutType: 'region-relative',
                orient: xAxisPosition,
                height: 20,
                visible: true,
                zIndex: 10001,
                style: {
                  react: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();

                    return {
                      pointerEvents: true,
                      id: 'xAxisSwitch',
                      element: (
                        <Switch data={['bottom', 'top']} currentActive={xAxisPosition} onChange={setXAxisPosition} />
                      )
                    };
                  },
                  fill: 'pink',
                  x: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);
                    // return (bounds.x1 + bounds.x2) / 2;
                    return bounds.x1;
                  },

                  y: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);

                    return bounds.y1;
                  },
                  width: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);

                    return bounds.width();
                  },
                  height: (datum, ctx) => {
                    const bounds = ctx.getLayoutBounds();
                    console.log(bounds);

                    return bounds.height();
                  }
                }
              }
            ]
          } as ILineChartSpec
        }
      />
    </div>
  );
}

const TestTooltip = ({ actualTooltip }: ITooltipRenderProps) => (
  <div style={{ color: 'red', padding: 5 }}>🏀 {actualTooltip.title.value}</div>
);

export default App;
