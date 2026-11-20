---
category: examples
group: bar chart
title: Bi-directional Bar Chart
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/bi-direction-bar.png
option: barChart
---

# Bi-directional Bar Chart

During the drawing process of the bar chart, when there are positive and negative values in the data, the bar chart will be automatically drawn according to the direction of the positive and negative values. In order to better display the difference between positive and negative values, we highlight the differences between positive and negative values by differentiating the colors of the bars.

## Key option

- Set the `direction` attribute to 'horizontal'
- Declare the `xField` attribute as the numeric field
- Declare the `yField` attribute as the categorical field
- Set the `bar.style.fill` attribute as a callback function that returns different colors depending on the positive or negative values of the data

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          state: 'District of Columbia',
          ratio: 0.1728802123236107
        },
        {
          state: 'Utah',
          ratio: 0.1599462351002303
        },
        {
          state: 'Texas',
          ratio: 0.15312126064715756
        },
        {
          state: 'Colorado',
          ratio: 0.14506096004212204
        },
        {
          state: 'Florida',
          ratio: 0.14235321900442044
        },
        {
          state: 'Nevada',
          ratio: 0.14056575861740808
        },
        {
          state: 'Idaho',
          ratio: 0.1400660380126845
        },
        {
          state: 'Arizona',
          ratio: 0.13871990640825893
        },
        {
          state: 'North Dakota',
          ratio: 0.13302437885728474
        },
        {
          state: 'Washington',
          ratio: 0.13240355474129084
        },
        {
          state: 'South Carolina',
          ratio: 0.11314785171502179
        },
        {
          state: 'Oregon',
          ratio: 0.10092809483711356
        },
        {
          state: 'North Carolina',
          ratio: 0.09990065526832778
        },
        {
          state: 'Georgia',
          ratio: 0.09597474228277994
        },
        {
          state: 'South Dakota',
          ratio: 0.08656439607949103
        },
        {
          state: 'Delaware',
          ratio: 0.08444941387674372
        },
        {
          state: 'Montana',
          ratio: 0.08021204449093657
        },
        {
          state: 'Tennessee',
          ratio: 0.07675085741569042
        },
        {
          state: 'Virginia',
          ratio: 0.06680332417450566
        },
        {
          state: 'Minnesota',
          ratio: 0.06329406995762572
        },
        {
          state: 'Massachusetts',
          ratio: 0.061377026706919406
        },
        {
          state: 'California',
          ratio: 0.06060203750293622
        },
        {
          state: 'Nebraska',
          ratio: 0.05917131576195245
        },
        {
          state: 'Oklahoma',
          ratio: 0.05481225297232917
        },
        {
          state: 'Maryland',
          ratio: 0.04713354967617855
        },
        {
          state: 'Hawaii',
          ratio: 0.04085198790561795
        },
        {
          state: 'Indiana',
          ratio: 0.038313477185145384
        },
        {
          state: 'Iowa',
          ratio: 0.03568691107897799
        },
        {
          state: 'Arkansas',
          ratio: 0.03494851364133011
        },
        {
          state: 'New Hampshire',
          ratio: 0.03284617195986236
        },
        {
          state: 'Alaska',
          ratio: 0.030009954507758743
        },
        {
          state: 'Kentucky',
          ratio: 0.029567907024227267
        },
        {
          state: 'Wyoming',
          ratio: 0.026849364649608073
        },
        {
          state: 'Alabama',
          ratio: 0.025827577087939584
        },
        {
          state: 'Louisiana',
          ratio: 0.025460518130874767
        },
        {
          state: 'Missouri',
          ratio: 0.024795927550961966
        },
        {
          state: 'Wisconsin',
          ratio: 0.0238171854124487
        },
        {
          state: 'Kansas',
          ratio: 0.021098321205081597
        },
        {
          state: 'New Mexico',
          ratio: 0.018283985996360684
        },
        {
          state: 'Ohio',
          ratio: 0.013227230710447463
        },
        {
          state: 'Maine',
          ratio: 0.011932750208715854
        },
        {
          state: 'Michigan',
          ratio: 0.010443217276226168
        },
        {
          state: 'New Jersey',
          ratio: 0.010270369501725113
        },
        {
          state: 'Pennsylvania',
          ratio: 0.007841838131266592
        },
        {
          state: 'Rhode Island',
          ratio: 0.00645469599559933
        },
        {
          state: 'New York',
          ratio: 0.0038940346170125433
        },
        {
          state: 'Mississippi',
          ratio: 0.0029831863814104216
        },
        {
          state: 'Connecticut',
          ratio: -0.0024649582817701924
        },
        {
          state: 'Vermont',
          ratio: -0.0027998804617245794
        },
        {
          state: 'Illinois',
          ratio: -0.01237748849783861
        },
        {
          state: 'West Virginia',
          ratio: -0.032881380080021845
        },
        {
          state: 'Puerto Rico',
          ratio: -0.14281404556189306
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'ratio',
  yField: 'state',
  title: {
    visible: true,
    text: 'State population change',
    subtext: 'Referenced from https://observablehq.com/@observablehq/plot-state-population-change'
  },
  bar: {
    style: {
      fill(datum) {
        if (datum.ratio < 0) {
          return 'rgb(233, 163, 201)';
        }

        return 'rgb(161, 215, 106)';
      }
    }
  },
  axes: [
    {
      orient: 'left',
      domainLine: {
        onZero: true
      },
      tick: {
        visible: false
      },
      label: {
        visible: false
      }
    },
    {
      orient: 'top',
      title: {
        visible: true,
        text: '← decrease · Change in population, 2010–2019 (%) · increase →',
        position: 'center'
      },
      label: {
        formatMethod: val => {
          return `${(val * 100).toFixed(0)}%`;
        }
      }
    }
  ],
  tooltip: {
    dimension: {
      visible: false
    },
    mark: {
      title: false,
      content: [
        {
          key: datum => datum.state,
          value: datum => `${(datum.ratio * 100).toFixed(0)}%`
        }
      ]
    }
  },
  label: {
    visible: false
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
