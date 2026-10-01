# How to display scales at several points on the x-axis of an area chart?

## Question Description

Area charts like (https://www.visactor.io/vchart/demo/area-chart/null-value-area) contain a lot of data, such as hundreds. When the label content on some axes is too long, it is easy to overlap or be too visually dense. The scales on the X-axis need to be displayed at certain intervals.

Is there any configuration for this type of chart so that the coordinate axis displays scales every few points, similar to echarts' interval?

## Solution

Different chart libraries have different solutions. According to the demo you gave, you only need to enable axis sampling in VChart to avoid the problem of axis text occlusion.

- sampling Whether to enable axis data sampling, enabled by default. After axis sampling is turned on, axis data will be sampled and displayed to prevent overlapping of axis data.

If you also want to customize the spacing between axis labels, you can control the spacing between axis labels by configuring label.minGap.

- MinGap can be used to customize the minimum spacing between labels (unit: pixels). Only takes effect when axis sampling starts (sampling: true). This configuration affects the results of axis sampling.

## Code Example

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      { month: '1980-05', vacancies: 36.7 },
      { month: '1980-08', vacancies: 37.5 },
      { month: '1980-11', vacancies: 38.7 },
      { month: '1981-02', vacancies: 37.4 },
      { month: '1981-05', vacancies: 44 },
      { month: '1981-08', vacancies: 44.5 },
      { month: '1981-11', vacancies: 41.7 },
      { month: '1982-02', vacancies: 37.3 },
      { month: '1982-05', vacancies: 30.3 },
      { month: '1982-08', vacancies: 26.8 },
      { month: '1982-11', vacancies: 30.3 },
      { month: '1983-02', vacancies: 29.7 },
      { month: '1983-05', vacancies: 32.4 },
      { month: '1983-08', vacancies: 33.6 },
      { month: '1983-11', vacancies: 36.3 },
      { month: '1984-02', vacancies: 44.6 },
      { month: '1984-05', vacancies: 40.3 },
      { month: '1984-08', vacancies: 48.5 },
      { month: '1984-11', vacancies: 49.8 },
      { month: '1985-02', vacancies: 60.4 },
      { month: '1985-05', vacancies: 68.6 },
      { month: '1985-08', vacancies: 67.2 },
      { month: '1985-11', vacancies: 66.2 },
      { month: '1986-02', vacancies: 64.8 },
      { month: '1986-05', vacancies: 66.1 },
      { month: '1986-08', vacancies: 61.1 },
      { month: '1986-11', vacancies: 66.3 },
      { month: '1987-02', vacancies: 69.5 },
      { month: '1987-05', vacancies: 66.9 },
      { month: '1987-08', vacancies: 70.1 },
      { month: '1987-11', vacancies: 66.9 },
      { month: '1988-02', vacancies: 70.2 },
      { month: '1988-05', vacancies: 74.4 },
      { month: '1988-08', vacancies: 80.8 },
      { month: '1988-11', vacancies: 85.1 },
      { month: '1989-02', vacancies: 84.7 },
      { month: '1989-05', vacancies: 93.7 },
      { month: '1989-08', vacancies: 76.6 },
      { month: '1989-11', vacancies: 79.2 },
      { month: '1990-02', vacancies: 71.9 },
      { month: '1990-05', vacancies: 64 },
      { month: '1990-08', vacancies: 56.7 },
      { month: '1990-11', vacancies: 41.6 },
      { month: '1991-02', vacancies: 33.8 },
      { month: '1991-05', vacancies: 31.6 },
      { month: '1991-08', vacancies: 29.8 },
      { month: '1991-11', vacancies: 30.9 },
      { month: '1992-02', vacancies: 33.3 },
      { month: '1992-05', vacancies: 31.9 },
      { month: '1992-08', vacancies: 33 },
      { month: '1992-11', vacancies: 36.9 },
      { month: '1993-02', vacancies: 37 },
      { month: '1993-05', vacancies: 42 },
      { month: '1993-08', vacancies: 46.2 },
      { month: '1993-11', vacancies: 48.5 },
      { month: '1994-02', vacancies: 57.6 },
      { month: '1994-05', vacancies: 69.5 },
      { month: '1994-08', vacancies: 82.2 },
      { month: '1994-11', vacancies: 85.6 },
      { month: '1995-02', vacancies: 72.7 },
      { month: '1995-05', vacancies: 77.3 },
      { month: '1995-08', vacancies: 74.6 },
      { month: '1995-11', vacancies: 72.5 },
      { month: '1996-02', vacancies: 81 },
      { month: '1996-05', vacancies: 76.7 },
      { month: '1996-08', vacancies: 77.5 },
      { month: '1996-11', vacancies: 82.5 },
      { month: '1997-02', vacancies: 81.3 },
      { month: '1997-05', vacancies: 82.8 },
      { month: '1997-08', vacancies: 84.9 },
      { month: '1997-11', vacancies: 90.4 },
      { month: '1998-02', vacancies: 98.3 },
      { month: '1998-05', vacancies: 104 },
      { month: '1998-08', vacancies: 89.8 },
      { month: '1998-11', vacancies: 102 },
      { month: '1999-02', vacancies: 87.2 },
      { month: '1999-05', vacancies: 100.2 },
      { month: '1999-08', vacancies: 106.9 },
      { month: '1999-11', vacancies: 109.6 },
      { month: '2000-02', vacancies: 118.1 },
      { month: '2000-05', vacancies: 115.9 },
      { month: '2000-08', vacancies: 114.4 },
      { month: '2000-11', vacancies: 114.8 },
      { month: '2001-02', vacancies: 99.7 },
      { month: '2001-05', vacancies: 94 },
      { month: '2001-08', vacancies: 90.2 },
      { month: '2001-11', vacancies: 88.5 },
      { month: '2002-02', vacancies: 90.5 },
      { month: '2002-05', vacancies: 96.2 },
      { month: '2002-08', vacancies: 103 },
      { month: '2002-11', vacancies: 97.6 },
      { month: '2003-02', vacancies: 109.7 },
      { month: '2003-05', vacancies: 104.6 },
      { month: '2003-08', vacancies: 104.1 },
      { month: '2003-11', vacancies: 107.5 },
      { month: '2004-02', vacancies: 103.8 },
      { month: '2004-05', vacancies: 127.1 },
      { month: '2004-08', vacancies: 124.6 },
      { month: '2004-11', vacancies: 139.2 },
      { month: '2005-02', vacancies: 146.2 },
      { month: '2005-05', vacancies: 140.9 },
      { month: '2005-08', vacancies: 139 },
      { month: '2005-11', vacancies: 134.1 },
      { month: '2006-02', vacancies: 144.3 },
      { month: '2006-05', vacancies: 154.1 },
      { month: '2006-08', vacancies: 154.9 },
      { month: '2006-11', vacancies: 162.1 },
      { month: '2007-02', vacancies: 160.8 },
      { month: '2007-05', vacancies: 168.6 },
      { month: '2007-08', vacancies: 173.3 },
      { month: '2007-11', vacancies: 183.3 },
      { month: '2008-02', vacancies: 178.2 },
      { month: '2008-05', vacancies: 184.5 },
      { month: '2008-08', vacancies: null },
      { month: '2008-11', vacancies: null },
      { month: '2009-02', vacancies: null },
      { month: '2009-05', vacancies: null },
      { month: '2009-08', vacancies: null },
      { month: '2009-11', vacancies: 148.9 },
      { month: '2010-02', vacancies: 168.4 },
      { month: '2010-05', vacancies: 170.3 },
      { month: '2010-08', vacancies: 178.6 },
      { month: '2010-11', vacancies: 191.1 },
      { month: '2011-02', vacancies: 189.4 },
      { month: '2011-05', vacancies: 187.3 },
      { month: '2011-08', vacancies: 183.4 },
      { month: '2011-11', vacancies: 179.3 },
      { month: '2012-02', vacancies: 181.8 },
      { month: '2012-05', vacancies: 178.1 },
      { month: '2012-08', vacancies: 175.3 },
      { month: '2012-11', vacancies: 164.8 },
      { month: '2013-02', vacancies: 149.8 },
      { month: '2013-05', vacancies: 143.5 },
      { month: '2013-08', vacancies: 140.6 },
      { month: '2013-11', vacancies: 138.9 },
      { month: '2014-02', vacancies: 143.2 },
      { month: '2014-05', vacancies: 147.4 },
      { month: '2014-08', vacancies: 146.6 },
      { month: '2014-11', vacancies: 149.7 },
      { month: '2015-02', vacancies: 151.9 },
      { month: '2015-05', vacancies: 157.7 },
      { month: '2015-08', vacancies: 161.7 },
      { month: '2015-11', vacancies: 167.4 },
      { month: '2016-02', vacancies: 172.2 },
      { month: '2016-05', vacancies: 171.1 },
      { month: '2016-08', vacancies: 177.5 },
      { month: '2016-11', vacancies: 182.3 },
      { month: '2017-02', vacancies: 185 },
      { month: '2017-05', vacancies: 185.6 },
      { month: '2017-08', vacancies: 200.9 },
      { month: '2017-11', vacancies: 204.4 },
      { month: '2018-02', vacancies: 212.8 },
      { month: '2018-05', vacancies: 223.8 },
      { month: '2018-08', vacancies: 228.7 },
      { month: '2018-11', vacancies: 230.2 },
      { month: '2019-02', vacancies: 232.4 },
      { month: '2019-05', vacancies: 228.1 },
      { month: '2019-08', vacancies: 224.3 },
      { month: '2019-11', vacancies: 226.7 },
      { month: '2020-02', vacancies: 227.4 },
      { month: '2020-05', vacancies: 129.2 },
      { month: '2020-08', vacancies: 206.3 },
      { month: '2020-11', vacancies: 254.1 },
      { month: '2021-02', vacancies: 288 },
      { month: '2021-05', vacancies: 370.2 },
      { month: '2021-08', vacancies: 333.9 },
      { month: '2021-11', vacancies: 397.2 },
      { month: '2022-02', vacancies: 421.9 },
      { month: '2022-05', vacancies: 480.1 }
    ]
  },
  xField: 'month',
  yField: 'vacancies',
  invalidType: 'break',
  point: {
    visible: false
  },
  title: {
    text: 'Job vacancies, seasonally adjusted',
    subtext: 'Source: Australian Bureau of Statistics, 30 June 2022'
  },
  axes: [
    {
      orient: 'left',
      title: {
        visible: true,
        text: 'thousands'
      }
    },
    {
      orient: 'bottom',
      sampling: true,
      label: {
        minGap: 100
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Results

- [Online demo](https://codesandbox.io/s/scales-at-several-points-on-the-x-axis-xxnp9r)

## Quote

- [Area chart with null values demo](https://www.visactor.io/vchart/demo/area-chart/null-value-area)
- [Area Chart Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Area)
- [Related api](https://www.visactor.io/vchart/option/areaChart#axes-band.sampling)
- [github](https://github.com/VisActor/VChart)
