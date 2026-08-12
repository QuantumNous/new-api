---
category: examples
group: word chart
title: Shape Word Cloud Custom Color
keywords: wordCloud,text,distribution
order: 14-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-shape-custom-color.png
option: wordCloudChart
---

# Shape Word Cloud Custom Color

Customize the color mapping of core words and filler words through the configuration of the color list

## Key Configuration

- `nameField` property is declared as the text field
- `valueField` property is declared as the text size field
- `maskShape` property is declared as the shape contour
- `colorList` property is declared as the random selection range of core word colors, i.e. the core word colors are randomly selected from this array
- `wordCloudShapeConfig.fillingColorList` property is declared as the random selection range for filler word colors, i.e. filler word colors are randomly selected from this array

## Demo source

```javascript livedemo
const spec = {
  type: 'wordCloud',
  maskShape: `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/shape_logo.png`,
  colorList: ['#325AB4'],
  wordCloudShapeConfig: {
    fillingColorList: ['#5BB5BF', '#92C8C6']
  },
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  data: [
    {
      name: 'data',
      values: [
        {
          sum_count: '1458156.9184036255',
          challenge_name: '广东',
          fontStyle: 'normal',
          fontFamily: '报隶-简'
        },
        {
          sum_count: '409147.19856643677',
          challenge_name: '北京',
          hex: 'black',
          fontStyle: 'normal',
          fontFamily: '华文楷体'
        },
        {
          sum_count: '409147.19856643677',
          challenge_name: '北京',
          hex: 'black',
          fontWeight: '900',
          fontStyle: 'italic'
        },
        {
          sum_count: '835974.6672067642',
          challenge_name: '辽宁'
        },
        {
          sum_count: '108141.60027313232',
          challenge_name: '贵州'
        },
        {
          sum_count: '108141.60027313232',
          challenge_name: '贵州'
        },
        {
          sum_count: '1208457.0841751099',
          challenge_name: '黑龙江'
        },
        {
          sum_count: '628965.1919708252',
          challenge_name: '安徽'
        },
        {
          sum_count: '361761.9318008423',
          challenge_name: '重庆'
        },
        {
          sum_count: '627201.8465929031',
          challenge_name: '湖北'
        },
        {
          sum_count: '464225.63437461853',
          challenge_name: '浙江'
        },
        {
          sum_count: '457688.1689968109',
          challenge_name: '陕西'
        },
        {
          sum_count: '179270.02758216858',
          challenge_name: '甘肃'
        },
        {
          sum_count: '666791.6433677673',
          challenge_name: '吉林'
        },
        {
          sum_count: '582450.5663032532',
          challenge_name: '上海'
        },
        {
          sum_count: '723442.2084827423',
          challenge_name: '湖南'
        },
        {
          sum_count: '422328.201543808',
          challenge_name: '云南'
        },
        {
          sum_count: '546903.5310325623',
          challenge_name: '福建'
        },
        {
          sum_count: '273453.012925148',
          challenge_name: '内蒙古'
        },
        {
          sum_count: '1586782.9900550842',
          challenge_name: '山东'
        },
        {
          sum_count: '549906.6289558411',
          challenge_name: '天津'
        },
        {
          sum_count: '409147.19856643677',
          challenge_name: '北京'
        },
        {
          sum_count: '58121.000633239746',
          challenge_name: '宁夏'
        },
        {
          sum_count: '790915.4042472839',
          challenge_name: '河北'
        },
        {
          sum_count: '49863.379943847656',
          challenge_name: '青海'
        },
        {
          sum_count: '377653.828125',
          challenge_name: '广西'
        },
        {
          sum_count: '10015.179809570312',
          challenge_name: '西藏'
        },
        {
          sum_count: '237328.70012283325',
          challenge_name: '江西'
        },
        {
          sum_count: '423878.76944351196',
          challenge_name: '山西'
        },
        {
          sum_count: '107854.41070175171',
          challenge_name: '海南'
        },
        {
          sum_count: '400877.59553718567',
          challenge_name: '四川'
        },
        {
          sum_count: '853574.8028030396',
          challenge_name: '河南'
        },
        {
          sum_count: '653052.960445404',
          challenge_name: '江苏'
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
