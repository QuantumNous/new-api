---
category: examples
group: area chart
title: 自定义图例icon
keywords: funnelChart,composition,trend,triangle
order: 5-0
cover: /vchart/preview/react-attributes_legend-icon_1.11.6.png
option: areaChart
---
# Custom Legend Items

When custom elements need to be displayed in legend items and complex interactions are required, custom extensions can be achieved through react attributes.

## Key Configurations

- `legend.item.formatMethod` sets the formatting method for legend labels, specifying `type: 'react'` in the return result to display labels using react elements with absolute positioning;
- `legend.item.label.style.boundsPadding` sets the right `padding` for legend labels to display icons.

## Code Demo
```javascript livedemo template=react-vchart
const root = document.getElementById(CONTAINER_ID);
const { VChart, AreaChart, Legend } = ReactVChart;
const { useState, useRef, useEffect, useCallback } = React;

const LegendLabel = props => {
  const { label } = props;
  const [isPoptipActive, setIsPoptipActive] = useState(false);

  const handleEnter = useCallback(() => {
    setIsPoptipActive(true);
  });
  const handleLeave = useCallback(() => {
    setIsPoptipActive(false);
  });

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ margin: 0, lineHeight: '20px' }}>
        <span style={{ color: 'inherit' }}>{label}</span>
        <span style={{ verticalAlign: 'middle', pointerEvents: 'all', color: 'inherit' }}>
          <svg
            style={{ display: 'inline-block', verticalAlign: 'text-bottom', cursor: 'pointer' }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
          >
            <path
              d="M774.656 774.656a371.2 371.2 0 1 0-524.8 0 371.2 371.2 0 0 0 524.8 0zM819.2 819.2a435.2 435.2 0 1 1 0-614.4 435.2 435.2 0 0 1 0 614.4zM516.608 296.96a120.32 120.32 0 0 0-93.696 37.376 129.024 129.024 0 0 0-32.768 92.672v10.24h60.928v-10.24a82.944 82.944 0 0 1 14.848-51.2 55.296 55.296 0 0 1 51.2-20.992 56.32 56.32 0 0 1 43.008 14.848 54.784 54.784 0 0 1 14.336 40.448 51.2 51.2 0 0 1-13.312 34.304 199.168 199.168 0 0 1-16.896 17.408 219.136 219.136 0 0 0-51.2 62.464 111.616 111.616 0 0 0-10.24 51.2v22.016h61.44v-22.016a61.44 61.44 0 0 1 8.192-32.256 95.744 95.744 0 0 1 22.016-25.6 512 512 0 0 0 39.936-44.544 107.008 107.008 0 0 0 22.016-66.56 102.4 102.4 0 0 0-31.744-79.872 120.832 120.832 0 0 0-88.064-29.696z m-7.68 331.776a39.424 39.424 0 0 0-29.184 11.776 37.376 37.376 0 0 0-11.776 28.672 39.424 39.424 0 0 0 11.776 29.184 42.496 42.496 0 0 0 58.368 0 38.4 38.4 0 0 0 12.288-29.696 39.424 39.424 0 0 0-11.776-28.672 40.448 40.448 0 0 0-29.696-11.264z"
              fill="#5A5A68"
            ></path>
          </svg>
        </span>
      </p>
      {isPoptipActive ? (
        <div
          style={{
            position: 'absolute',
            padding: '10px',
            width: '200px',
            border: '1px solid #ccc',
            bottom: '20px',
            lineHeight: '20px',
            background: '#fff',
            margin: 0
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
          <p style={{ margin: 0 }}>{`this is a simple poptip about ${label}`}</p>
        </div>
      ) : null}
    </div>
  );
};

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const formatLegendLabel = useCallback((label, datum) => {
    return {
      type: 'react',
      text: {
        element: <LegendLabel label={label} />
      }
    };
  });

  return (
    <AreaChart
      ref={chartRef}
      options={{
        // Note: In actual usage scenarios, you need to import it yourself: `import ReactDOM from 'react-dom/client';`
        ReactDOM: ReactDom
      }}
      spec={{
        type: 'area',
        data: {
          values: [
            { date: '2024-05-01', clickRate: 0.123, payRate: 0.022 },
            { date: '2024-05-02', clickRate: 0.223, payRate: 0.022 },
            { date: '2024-05-03', clickRate: 0.156, payRate: 0.022 },
            { date: '2024-05-04', clickRate: 0.323, payRate: 0.022 },
            { date: '2024-05-05', clickRate: 0.223, payRate: 0.022 },
            { date: '2024-05-06', clickRate: 0.423, payRate: 0.022 },
            { date: '2024-05-07', clickRate: 0.143, payRate: 0.022 }
          ],
          transforms: [
            {
              type: 'fold',
              options: {
                key: 'indexName', // The key of the original data after transformation is placed into this field as the value
                value: 'indexValue', // The value of the original data after transformation is placed into this field as the value
                fields: ['clickRate', 'payRate'] // Dimensions that need to be transformed
              }
            }
          ]
        },
        title: {
          visible: true,
          text: 'Trend of data'
        },
        stack: false,
        xField: 'date',
        yField: 'indexValue',
        seriesField: 'indexName',
        legends: [
          {
            visible: true,
            position: 'middle',
            orient: 'bottom',
            item: {
              label: {
                style: {
                  boundsPadding: [0, 20, 0, 0] // Expand the placeholder space for the label
                },
                formatMethod: formatLegendLabel
              }
            }
          }
        ]
      }}
    />
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```
