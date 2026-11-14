---
category: examples
group: marker
title: TrendLine
keywords: marker,scatterChart
order: 33-6
cover: /vchart/preview/trend-line-1.12.0.png
option: scatterChart#markLine
---

# 使用 MarkLine 绘制趋势线

## 关键配置

- 通过 `markLine.positions` 属性的回调函数支持趋势线的绘制

## 代码演示

```javascript livedemo
function determinationCoefficient(data, results) {
  const predictions = [];
  const observations = [];

  data.forEach((d, i) => {
    if (d[1] !== null) {
      observations.push(d);
      predictions.push(results[i]);
    }
  });

  const sum = observations.reduce((a, observation) => a + observation[1], 0);
  const mean = sum / observations.length;

  const ssyy = observations.reduce((a, observation) => {
    const difference = observation[1] - mean;
    return a + difference * difference;
  }, 0);

  const sse = observations.reduce((accum, observation, index) => {
    const prediction = predictions[index];
    const residual = observation[1] - prediction[1];
    return accum + residual * residual;
  }, 0);

  return 1 - sse / ssyy;
}

function round(number, precision) {
  const factor = 10 ** precision;
  return Math.round(number * factor) / factor;
}

function logarithmic(data, options) {
  const sum = [0, 0, 0, 0];
  const len = data.length;

  for (let n = 0; n < len; n++) {
    if (data[n][1] !== null) {
      sum[0] += Math.log(data[n][0]);
      sum[1] += data[n][1] * Math.log(data[n][0]);
      sum[2] += data[n][1];
      sum[3] += Math.log(data[n][0]) ** 2;
    }
  }

  const a = (len * sum[1] - sum[2] * sum[0]) / (len * sum[3] - sum[0] * sum[0]);
  const coeffB = round(a, options.precision);
  const coeffA = round((sum[2] - coeffB * sum[0]) / len, options.precision);

  const predict = x => [
    round(x, options.precision),
    round(round(coeffA + coeffB * Math.log(x), options.precision), options.precision)
  ];

  const points = data.map(point => predict(point[0]));

  return {
    points,
    predict,
    equation: [coeffA, coeffB],
    string: `y = ${coeffA} + ${coeffB} ln(x)`,
    r2: round(determinationCoefficient(data, points), options.precision)
  };
}

const spec = {
  type: 'scatter',
  stack: false,
  size: [5, 50],

  xField: 'GDP per capita',
  yField: 'Life expectancy at birth',
  sizeField: 'Size',
  legends: {
    visible: false
  },
  data: [
    {
      id: '0',
      sourceKey: 'total',
      values: [
        {
          Country: 'Afghanistan',
          'GDP per capita': 1516.3057,
          'Life expectancy at birth': 62,
          'Fertility rate': 4.6434,
          'Child mortality rate': 5.79324,
          Size: 40099460
        },
        {
          Country: 'Albania',
          'GDP per capita': 14518.906,
          'Life expectancy at birth': 76.5,
          'Fertility rate': 1.3897,
          'Child mortality rate': 0.99849004,
          Size: 2854710
        },
        {
          Country: 'Algeria',
          'GDP per capita': 11039.806,
          'Life expectancy at birth': 76.4,
          'Fertility rate': 2.8886,
          'Child mortality rate': 2.21071,
          Size: 44177964
        },
        {
          Country: 'Angola',
          'GDP per capita': 5908.57,
          'Life expectancy at birth': 61.6,
          'Fertility rate': 5.3044,
          'Child mortality rate': 6.88471,
          Size: 34503776
        },
        {
          Country: 'Antigua and Barbuda',
          'GDP per capita': 19124.43,
          'Life expectancy at birth': 78.5,
          'Fertility rate': 1.5798,
          'Child mortality rate': 0.61823,
          Size: 93229
        },
        {
          Country: 'Argentina',
          'GDP per capita': 21527.195,
          'Life expectancy at birth': 75.4,
          'Fertility rate': 1.8854,
          'Child mortality rate': 1.07809,
          Size: 45276788
        },
        {
          Country: 'Armenia',
          'GDP per capita': 14193.117,
          'Life expectancy at birth': 72,
          'Fertility rate': 1.575,
          'Child mortality rate': 1.04387,
          Size: 2790971
        },
        {
          Country: 'Aruba',
          'GDP per capita': 38866.332,
          'Life expectancy at birth': 74.6,
          'Fertility rate': 1.1803,
          'Child mortality rate': 1.48334,
          Size: 106543
        },
        {
          Country: 'Australia',
          'GDP per capita': 49774.34,
          'Life expectancy at birth': 84.5,
          'Fertility rate': 1.5962,
          'Child mortality rate': 0.33908,
          Size: 25921094
        },
        {
          Country: 'Austria',
          'GDP per capita': 54121.145,
          'Life expectancy at birth': 81.6,
          'Fertility rate': 1.4701,
          'Child mortality rate': 0.35735,
          Size: 8922086
        },
        {
          Country: 'Azerbaijan',
          'GDP per capita': 14431.661,
          'Life expectancy at birth': 69.4,
          'Fertility rate': 1.6638,
          'Child mortality rate': 1.86127,
          Size: 10312992
        },
        {
          Country: 'Bahamas',
          'GDP per capita': 30210.162,
          'Life expectancy at birth': 71.6,
          'Fertility rate': 1.3889,
          'Child mortality rate': 1.1871899,
          Size: 407920
        },
        {
          Country: 'Bahrain',
          'GDP per capita': 49387.418,
          'Life expectancy at birth': 78.8,
          'Fertility rate': 1.811,
          'Child mortality rate': 0.67073,
          Size: 1463266
        },
        {
          Country: 'Bangladesh',
          'GDP per capita': 5911.013,
          'Life expectancy at birth': 72.4,
          'Fertility rate': 1.981,
          'Child mortality rate': 2.7698998,
          Size: 169356240
        },
        {
          Country: 'Barbados',
          'GDP per capita': 13754.803,
          'Life expectancy at birth': 77.6,
          'Fertility rate': 1.6327,
          'Child mortality rate': 1.1844,
          Size: 281204
        },
        {
          Country: 'Belarus',
          'GDP per capita': 19751.203,
          'Life expectancy at birth': 72.4,
          'Fertility rate': 1.483,
          'Child mortality rate': 0.27184,
          Size: 9578172
        },
        {
          Country: 'Belgium',
          'GDP per capita': 51739.54,
          'Life expectancy at birth': 81.9,
          'Fertility rate': 1.5831,
          'Child mortality rate': 0.39669,
          Size: 11611416
        },
        {
          Country: 'Belize',
          'GDP per capita': 8762.623,
          'Life expectancy at birth': 70.5,
          'Fertility rate': 2.0104,
          'Child mortality rate': 1.1736801,
          Size: 400037
        },
        {
          Country: 'Benin',
          'GDP per capita': 3321.5522,
          'Life expectancy at birth': 59.8,
          'Fertility rate': 4.9731,
          'Child mortality rate': 8.33789,
          Size: 12996901
        },
        {
          Country: 'Bermuda',
          'GDP per capita': 80271.13,
          'Life expectancy at birth': 79.3,
          'Fertility rate': 1.3631,
          'Child mortality rate': 0.28224,
          Size: 64213
        },
        {
          Country: 'Bhutan',
          'GDP per capita': 10907.856,
          'Life expectancy at birth': 71.8,
          'Fertility rate': 1.4132,
          'Child mortality rate': 2.68407,
          Size: 777500
        },
        {
          Country: 'Bolivia',
          'GDP per capita': 8052.1772,
          'Life expectancy at birth': 63.6,
          'Fertility rate': 2.6178,
          'Child mortality rate': 3.55129,
          Size: 12079474
        },
        {
          Country: 'Bosnia and Herzegovina',
          'GDP per capita': 15666.54,
          'Life expectancy at birth': 75.3,
          'Fertility rate': 1.3498,
          'Child mortality rate': 0.55809003,
          Size: 3270948
        },
        {
          Country: 'Botswana',
          'GDP per capita': 14840.913,
          'Life expectancy at birth': 61.1,
          'Fertility rate': 2.7914,
          'Child mortality rate': 4.44968,
          Size: 2588424
        },
        {
          Country: 'Brazil',
          'GDP per capita': 14592.353,
          'Life expectancy at birth': 72.8,
          'Fertility rate': 1.6406,
          'Child mortality rate': 1.4446,
          Size: 214326224
        },
        {
          Country: 'Brunei',
          'GDP per capita': 60127.023,
          'Life expectancy at birth': 74.6,
          'Fertility rate': 1.7779,
          'Child mortality rate': 1.10831,
          Size: 445382
        },
        {
          Country: 'Bulgaria',
          'GDP per capita': 24398.13,
          'Life expectancy at birth': 71.8,
          'Fertility rate': 1.586,
          'Child mortality rate': 0.61714,
          Size: 6885864
        },
        {
          Country: 'Burkina Faso',
          'GDP per capita': 2179.789,
          'Life expectancy at birth': 59.3,
          'Fertility rate': 4.7718,
          'Child mortality rate': 8.27705,
          Size: 22100690
        },
        {
          Country: 'Burundi',
          'GDP per capita': 705.0304,
          'Life expectancy at birth': 61.7,
          'Fertility rate': 5.0779,
          'Child mortality rate': 5.24944,
          Size: 12551215
        },
        {
          Country: 'Cambodia',
          'GDP per capita': 4354.5654,
          'Life expectancy at birth': 69.6,
          'Fertility rate': 2.3438,
          'Child mortality rate': 2.47492,
          Size: 16589031
        },
        {
          Country: 'Cameroon',
          'GDP per capita': 3700.4644,
          'Life expectancy at birth': 60.3,
          'Fertility rate': 4.4633,
          'Child mortality rate': 6.9737396,
          Size: 27198632
        },
        {
          Country: 'Canada',
          'GDP per capita': 47892.945,
          'Life expectancy at birth': 82.7,
          'Fertility rate': 1.4635,
          'Child mortality rate': 0.48908,
          Size: 38155012
        },
        {
          Country: 'Cape Verde',
          'GDP per capita': 6114.1333,
          'Life expectancy at birth': 74.1,
          'Fertility rate': 1.8956,
          'Child mortality rate': 1.35761,
          Size: 587936
        },
        {
          Country: 'Cayman Islands',
          'GDP per capita': 67500.1,
          'Life expectancy at birth': 75.1,
          'Fertility rate': 1.2191,
          'Child mortality rate': 0.93649995,
          Size: 68157
        },
        {
          Country: 'Central African Republic',
          'GDP per capita': 837.5047,
          'Life expectancy at birth': 53.9,
          'Fertility rate': 5.9783,
          'Child mortality rate': 10.1913595,
          Size: 5457165
        },
        {
          Country: 'Chad',
          'GDP per capita': 1425.4945,
          'Life expectancy at birth': 52.5,
          'Fertility rate': 6.2549,
          'Child mortality rate': 10.66955,
          Size: 17179744
        },
        {
          Country: 'Chile',
          'GDP per capita': 25449.13,
          'Life expectancy at birth': 78.9,
          'Fertility rate': 1.5375,
          'Child mortality rate': 0.56016004,
          Size: 19493184
        },
        {
          Country: 'China',
          'GDP per capita': 17602.695,
          'Life expectancy at birth': 78.2,
          'Fertility rate': 1.164,
          'Child mortality rate': 0.68583,
          Size: 1425893504
        },
        {
          Country: 'Colombia',
          'GDP per capita': 14648.592,
          'Life expectancy at birth': 72.8,
          'Fertility rate': 1.7168,
          'Child mortality rate': 1.29233,
          Size: 51516560
        },
        {
          Country: 'Comoros',
          'GDP per capita': 3228.5269,
          'Life expectancy at birth': 63.4,
          'Fertility rate': 3.9777,
          'Child mortality rate': 5.85155,
          Size: 821632
        },
        {
          Country: 'Congo',
          'GDP per capita': 3234.393,
          'Life expectancy at birth': 63.5,
          'Fertility rate': 4.1707,
          'Child mortality rate': 4.3193297,
          Size: 5835814
        },
        {
          Country: 'Costa Rica',
          'GDP per capita': 21199.281,
          'Life expectancy at birth': 77,
          'Fertility rate': 1.5335,
          'Child mortality rate': 0.7631,
          Size: 5153959
        },
        {
          Country: "Cote d'Ivoire",
          'GDP per capita': 5325.0303,
          'Life expectancy at birth': 58.6,
          'Fertility rate': 4.418,
          'Child mortality rate': 7.56744,
          Size: 27478250
        },
        {
          Country: 'Croatia',
          'GDP per capita': 31635.824,
          'Life expectancy at birth': 77.6,
          'Fertility rate': 1.4518,
          'Child mortality rate': 0.49962002,
          Size: 4060139
        },
        {
          Country: 'Curacao',
          'GDP per capita': 20783.086,
          'Life expectancy at birth': 75.4,
          'Fertility rate': 1.6509,
          'Child mortality rate': 0.98373,
          Size: 190348
        },
        {
          Country: 'Cyprus',
          'GDP per capita': 41701.703,
          'Life expectancy at birth': 81.2,
          'Fertility rate': 1.3208,
          'Child mortality rate': 0.27108,
          Size: 1244193
        },
        {
          Country: 'Czechia',
          'GDP per capita': 40740.992,
          'Life expectancy at birth': 77.7,
          'Fertility rate': 1.6986,
          'Child mortality rate': 0.28872,
          Size: 10510748
        },
        {
          Country: 'Democratic Republic of Congo',
          'GDP per capita': 1073.6433,
          'Life expectancy at birth': 59.2,
          'Fertility rate': 6.1564,
          'Child mortality rate': 7.8581495,
          Size: 95894120
        },
        {
          Country: 'Denmark',
          'GDP per capita': 57962.652,
          'Life expectancy at birth': 81.4,
          'Fertility rate': 1.7187,
          'Child mortality rate': 0.32694,
          Size: 5854246
        },
        {
          Country: 'Djibouti',
          'GDP per capita': 4913.2563,
          'Life expectancy at birth': 62.3,
          'Fertility rate': 2.8041,
          'Child mortality rate': 5.4339,
          Size: 1105562
        },
        {
          Country: 'Dominica',
          'GDP per capita': 10878.037,
          'Life expectancy at birth': 72.8,
          'Fertility rate': 1.5949,
          'Child mortality rate': 1.3676699,
          Size: 72435
        },
        {
          Country: 'Dominican Republic',
          'GDP per capita': 18626.078,
          'Life expectancy at birth': 72.6,
          'Fertility rate': 2.2727,
          'Child mortality rate': 3.2994301,
          Size: 11117873
        },
        {
          Country: 'Egypt',
          'GDP per capita': 11566.05,
          'Life expectancy at birth': 70.2,
          'Fertility rate': 2.9174,
          'Child mortality rate': 1.88508,
          Size: 109262184
        },
        {
          Country: 'Equatorial Guinea',
          'GDP per capita': 14637.008,
          'Life expectancy at birth': 60.6,
          'Fertility rate': 4.266,
          'Child mortality rate': 7.57025,
          Size: 1634473
        },
        {
          Country: 'Estonia',
          'GDP per capita': 38717.695,
          'Life expectancy at birth': 77.1,
          'Fertility rate': 1.6761,
          'Child mortality rate': 0.18729,
          Size: 1328704
        },
        {
          Country: 'Eswatini',
          'GDP per capita': 8856.829,
          'Life expectancy at birth': 57.1,
          'Fertility rate': 2.8395,
          'Child mortality rate': 5.05009,
          Size: 1192273
        },
        {
          Country: 'Ethiopia',
          'GDP per capita': 2319.0684,
          'Life expectancy at birth': 65,
          'Fertility rate': 4.1591,
          'Child mortality rate': 4.7206903,
          Size: 120283024
        },
        {
          Country: 'Fiji',
          'GDP per capita': 10359.204,
          'Life expectancy at birth': 67.1,
          'Fertility rate': 2.4748,
          'Child mortality rate': 2.79012,
          Size: 924615
        },
        {
          Country: 'Finland',
          'GDP per capita': 48753.355,
          'Life expectancy at birth': 82,
          'Fertility rate': 1.3891,
          'Child mortality rate': 0.23526001,
          Size: 5535982
        },
        {
          Country: 'France',
          'GDP per capita': 44993.125,
          'Life expectancy at birth': 82.5,
          'Fertility rate': 1.79,
          'Child mortality rate': 0.41957998,
          Size: 64531448
        },
        {
          Country: 'Gabon',
          'GDP per capita': 13813.723,
          'Life expectancy at birth': 65.8,
          'Fertility rate': 3.491,
          'Child mortality rate': 3.94095,
          Size: 2341185
        },
        {
          Country: 'Gambia',
          'GDP per capita': 2076.5664,
          'Life expectancy at birth': 62.1,
          'Fertility rate': 4.6838,
          'Child mortality rate': 4.78102,
          Size: 2639922
        },
        {
          Country: 'Ghana',
          'GDP per capita': 5435.238,
          'Life expectancy at birth': 63.8,
          'Fertility rate': 3.5633,
          'Child mortality rate': 4.32603,
          Size: 32833036
        },
        {
          Country: 'Greece',
          'GDP per capita': 29548.04,
          'Life expectancy at birth': 80.1,
          'Fertility rate': 1.371,
          'Child mortality rate': 0.39897,
          Size: 10445368
        },
        {
          Country: 'Grenada',
          'GDP per capita': 13688.256,
          'Life expectancy at birth': 74.9,
          'Fertility rate': 2.0043,
          'Child mortality rate': 1.60784,
          Size: 124624
        },
        {
          Country: 'Guatemala',
          'GDP per capita': 8926.7,
          'Life expectancy at birth': 69.2,
          'Fertility rate': 2.3948,
          'Child mortality rate': 2.2902,
          Size: 17608484
        },
        {
          Country: 'Guinea',
          'GDP per capita': 2640.3442,
          'Life expectancy at birth': 58.9,
          'Fertility rate': 4.3987,
          'Child mortality rate': 9.30472,
          Size: 13531909
        },
        {
          Country: 'Guinea-Bissau',
          'GDP per capita': 1831.3832,
          'Life expectancy at birth': 59.7,
          'Fertility rate': 4.0055,
          'Child mortality rate': 7.4228697,
          Size: 2060730
        },
        {
          Country: 'Guyana',
          'GDP per capita': 21925.188,
          'Life expectancy at birth': 65.7,
          'Fertility rate': 2.3972,
          'Child mortality rate': 2.7539,
          Size: 804571
        },
        {
          Country: 'Hong Kong',
          'GDP per capita': 59978.15,
          'Life expectancy at birth': 85.5,
          'Fertility rate': 0.7455,
          'Child mortality rate': 0.19231,
          Size: 7494580
        },
        {
          Country: 'Hungary',
          'GDP per capita': 33593.152,
          'Life expectancy at birth': 74.5,
          'Fertility rate': 1.5782,
          'Child mortality rate': 0.41023,
          Size: 9709784
        },
        {
          Country: 'Iceland',
          'GDP per capita': 53586.156,
          'Life expectancy at birth': 82.7,
          'Fertility rate': 1.7329,
          'Child mortality rate': 0.1495,
          Size: 370338
        },
        {
          Country: 'India',
          'GDP per capita': 6592.042,
          'Life expectancy at birth': 67.2,
          'Fertility rate': 2.0308,
          'Child mortality rate': 3.11861,
          Size: 1407563904
        },
        {
          Country: 'Indonesia',
          'GDP per capita': 11858.146,
          'Life expectancy at birth': 67.6,
          'Fertility rate': 2.1746,
          'Child mortality rate': 2.23194,
          Size: 273753184
        },
        {
          Country: 'Iraq',
          'GDP per capita': 8962.395,
          'Life expectancy at birth': 70.4,
          'Fertility rate': 3.4955,
          'Child mortality rate': 2.46205,
          Size: 43533592
        },
        {
          Country: 'Ireland',
          'GDP per capita': 102496.22,
          'Life expectancy at birth': 82,
          'Fertility rate': 1.7678,
          'Child mortality rate': 0.28796,
          Size: 4986525
        },
        {
          Country: 'Israel',
          'GDP per capita': 42061.242,
          'Life expectancy at birth': 82.3,
          'Fertility rate': 2.9764,
          'Child mortality rate': 0.37339002,
          Size: 8900057
        },
        {
          Country: 'Italy',
          'GDP per capita': 41929.43,
          'Life expectancy at birth': 82.9,
          'Fertility rate': 1.2825,
          'Child mortality rate': 0.27309,
          Size: 59240336
        },
        {
          Country: 'Jamaica',
          'GDP per capita': 9596.564,
          'Life expectancy at birth': 70.5,
          'Fertility rate': 1.352,
          'Child mortality rate': 1.33336,
          Size: 2827701
        },
        {
          Country: 'Jordan',
          'GDP per capita': 9223.147,
          'Life expectancy at birth': 74.3,
          'Fertility rate': 2.8297,
          'Child mortality rate': 1.43536,
          Size: 11148288
        },
        {
          Country: 'Kenya',
          'GDP per capita': 4743.4863,
          'Life expectancy at birth': 61.4,
          'Fertility rate': 3.3351,
          'Child mortality rate': 4.1131,
          Size: 53005616
        },
        {
          Country: 'Kiribati',
          'GDP per capita': 1937.0894,
          'Life expectancy at birth': 67.4,
          'Fertility rate': 3.3038,
          'Child mortality rate': 4.75164,
          Size: 128883
        },
        {
          Country: 'Kyrgyzstan',
          'GDP per capita': 4814.9565,
          'Life expectancy at birth': 70,
          'Fertility rate': 2.9912,
          'Child mortality rate': 1.68766,
          Size: 6527742
        },
        {
          Country: 'Latvia',
          'GDP per capita': 32081.455,
          'Life expectancy at birth': 73.6,
          'Fertility rate': 1.5827,
          'Child mortality rate': 0.39695,
          Size: 1873926
        },
        {
          Country: 'Lebanon',
          'GDP per capita': 12977.202,
          'Life expectancy at birth': 75,
          'Fertility rate': 2.0912,
          'Child mortality rate': 0.67698,
          Size: 5592626
        },
        {
          Country: 'Lesotho',
          'GDP per capita': 2295.2322,
          'Life expectancy at birth': 53.1,
          'Fertility rate': 3.0176,
          'Child mortality rate': 8.71052,
          Size: 2281464
        },
        {
          Country: 'Liberia',
          'GDP per capita': 1423.2296,
          'Life expectancy at birth': 60.7,
          'Fertility rate': 4.0885,
          'Child mortality rate': 7.54857,
          Size: 5193422
        },
        {
          Country: 'Libya',
          'GDP per capita': 21965.174,
          'Life expectancy at birth': 71.9,
          'Fertility rate': 2.4624,
          'Child mortality rate': 1.10779,
          Size: 6735280
        },
        {
          Country: 'Lithuania',
          'GDP per capita': 39305.613,
          'Life expectancy at birth': 73.7,
          'Fertility rate': 1.6222,
          'Child mortality rate': 0.33962,
          Size: 2786652
        },
        {
          Country: 'Luxembourg',
          'GDP per capita': 115683.49,
          'Life expectancy at birth': 82.6,
          'Fertility rate': 1.3877,
          'Child mortality rate': 0.52484,
          Size: 639330
        },
        {
          Country: 'Macao',
          'GDP per capita': 64796.996,
          'Life expectancy at birth': 85.4,
          'Fertility rate': 1.0883,
          'Child mortality rate': 0.32282,
          Size: 686616
        },
        {
          Country: 'Madagascar',
          'GDP per capita': 1463.6288,
          'Life expectancy at birth': 64.5,
          'Fertility rate': 3.8514,
          'Child mortality rate': 4.87476,
          Size: 28915652
        },
        {
          Country: 'Malawi',
          'GDP per capita': 1491.1339,
          'Life expectancy at birth': 62.9,
          'Fertility rate': 3.9165,
          'Child mortality rate': 3.8196702,
          Size: 19889742
        },
        {
          Country: 'Mali',
          'GDP per capita': 2120.6233,
          'Life expectancy at birth': 58.9,
          'Fertility rate': 5.9564,
          'Child mortality rate': 8.82339,
          Size: 21904990
        },
        {
          Country: 'Malta',
          'GDP per capita': 44658.72,
          'Life expectancy at birth': 83.8,
          'Fertility rate': 1.1783,
          'Child mortality rate': 0.42745,
          Size: 526751
        },
        {
          Country: 'Marshall Islands',
          'GDP per capita': 5961.8164,
          'Life expectancy at birth': 65.3,
          'Fertility rate': 2.7288,
          'Child mortality rate': 2.95682,
          Size: 42074
        },
        {
          Country: 'Mauritius',
          'GDP per capita': 20967.947,
          'Life expectancy at birth': 73.6,
          'Fertility rate': 1.4105,
          'Child mortality rate': 1.69755,
          Size: 1298922
        },
        {
          Country: 'Micronesia (country)',
          'GDP per capita': 3315.2302,
          'Life expectancy at birth': 70.7,
          'Fertility rate': 2.7114,
          'Child mortality rate': 2.38641,
          Size: 113143
        },
        {
          Country: 'Moldova',
          'GDP per capita': 14009.226,
          'Life expectancy at birth': 68.8,
          'Fertility rate': 1.8058,
          'Child mortality rate': 1.4253199,
          Size: 3061509
        },
        {
          Country: 'Mongolia',
          'GDP per capita': 11668.431,
          'Life expectancy at birth': 71,
          'Fertility rate': 2.8371,
          'Child mortality rate': 1.4805601,
          Size: 3347782
        },
        {
          Country: 'Montenegro',
          'GDP per capita': 20602.5,
          'Life expectancy at birth': 76.3,
          'Fertility rate': 1.6914,
          'Child mortality rate': 0.14623,
          Size: 627856
        },
        {
          Country: 'Morocco',
          'GDP per capita': 8058.397,
          'Life expectancy at birth': 74,
          'Fertility rate': 2.328,
          'Child mortality rate': 1.7918699,
          Size: 37076588
        },
        {
          Country: 'Mozambique',
          'GDP per capita': 1226.767,
          'Life expectancy at birth': 59.3,
          'Fertility rate': 4.6444,
          'Child mortality rate': 6.84142,
          Size: 32077074
        },
        {
          Country: 'Myanmar',
          'GDP per capita': 4032.6257,
          'Life expectancy at birth': 65.7,
          'Fertility rate': 2.1514,
          'Child mortality rate': 4.27911,
          Size: 53798088
        },
        {
          Country: 'Namibia',
          'GDP per capita': 9137.797,
          'Life expectancy at birth': 59.3,
          'Fertility rate': 3.3025,
          'Child mortality rate': 3.8573601,
          Size: 2530150
        },
        {
          Country: 'Nauru',
          'GDP per capita': 11947.395,
          'Life expectancy at birth': 63.6,
          'Fertility rate': 3.5187,
          'Child mortality rate': 1.8978001,
          Size: 12533
        },
        {
          Country: 'Nepal',
          'GDP per capita': 3831.9485,
          'Life expectancy at birth': 68.4,
          'Fertility rate': 2.0293,
          'Child mortality rate': 2.7374902,
          Size: 30034988
        },
        {
          Country: 'Netherlands',
          'GDP per capita': 56617.35,
          'Life expectancy at birth': 81.7,
          'Fertility rate': 1.6404,
          'Child mortality rate': 0.40461,
          Size: 17501696
        },
        {
          Country: 'New Zealand',
          'GDP per capita': 42915.453,
          'Life expectancy at birth': 82.5,
          'Fertility rate': 1.7733,
          'Child mortality rate': 0.46201,
          Size: 5129730
        },
        {
          Country: 'Nicaragua',
          'GDP per capita': 5638.748,
          'Life expectancy at birth': 73.8,
          'Fertility rate': 2.3213,
          'Child mortality rate': 1.54514,
          Size: 6850546
        },
        {
          Country: 'Niger',
          'GDP per capita': 1186.5768,
          'Life expectancy at birth': 61.6,
          'Fertility rate': 6.82,
          'Child mortality rate': 7.53853,
          Size: 25252722
        },
        {
          Country: 'Nigeria',
          'GDP per capita': 4922.6323,
          'Life expectancy at birth': 52.7,
          'Fertility rate': 5.2374,
          'Child mortality rate': 11.123549,
          Size: 213401328
        },
        {
          Country: 'North Macedonia',
          'GDP per capita': 16467.316,
          'Life expectancy at birth': 73.8,
          'Fertility rate': 1.3633,
          'Child mortality rate': 0.67988,
          Size: 2103329
        },
        {
          Country: 'Oman',
          'GDP per capita': 34294.766,
          'Life expectancy at birth': 72.5,
          'Fertility rate': 2.6233,
          'Child mortality rate': 1.11421,
          Size: 4520474
        },
        {
          Country: 'Pakistan',
          'GDP per capita': 5232.1426,
          'Life expectancy at birth': 66.1,
          'Fertility rate': 3.4698,
          'Child mortality rate': 6.3176603,
          Size: 231402112
        },
        {
          Country: 'Palau',
          'GDP per capita': 13785.397,
          'Life expectancy at birth': 66,
          'Fertility rate': 2.409,
          'Child mortality rate': 1.73272,
          Size: 18050
        },
        {
          Country: 'Panama',
          'GDP per capita': 29037.945,
          'Life expectancy at birth': 76.2,
          'Fertility rate': 2.3252,
          'Child mortality rate': 1.7161,
          Size: 4351264
        },
        {
          Country: 'Papua New Guinea',
          'GDP per capita': 3677.4602,
          'Life expectancy at birth': 65.4,
          'Fertility rate': 3.2147,
          'Child mortality rate': 4.22622,
          Size: 9949438
        },
        {
          Country: 'Paraguay',
          'GDP per capita': 13687.655,
          'Life expectancy at birth': 70.3,
          'Fertility rate': 2.4689,
          'Child mortality rate': 1.8373501,
          Size: 6703802
        },
        {
          Country: 'Peru',
          'GDP per capita': 12514.651,
          'Life expectancy at birth': 72.4,
          'Fertility rate': 2.1917,
          'Child mortality rate': 1.23791,
          Size: 33715464
        },
        {
          Country: 'Philippines',
          'GDP per capita': 8094.693,
          'Life expectancy at birth': 69.3,
          'Fertility rate': 2.7476,
          'Child mortality rate': 2.53896,
          Size: 113880336
        },
        {
          Country: 'Portugal',
          'GDP per capita': 33674.527,
          'Life expectancy at birth': 81,
          'Fertility rate': 1.3631,
          'Child mortality rate': 0.3335,
          Size: 10290109
        },
        {
          Country: 'Qatar',
          'GDP per capita': 92862.35,
          'Life expectancy at birth': 79.3,
          'Fertility rate': 1.8008,
          'Child mortality rate': 0.5544,
          Size: 2688239
        },
        {
          Country: 'Romania',
          'GDP per capita': 30776.93,
          'Life expectancy at birth': 74.2,
          'Fertility rate': 1.748,
          'Child mortality rate': 0.66375,
          Size: 19328558
        },
        {
          Country: 'Russia',
          'GDP per capita': 27960.102,
          'Life expectancy at birth': 69.4,
          'Fertility rate': 1.4927,
          'Child mortality rate': 0.48901,
          Size: 145102752
        },
        {
          Country: 'Rwanda',
          'GDP per capita': 2238.9573,
          'Life expectancy at birth': 66.1,
          'Fertility rate': 3.8207,
          'Child mortality rate': 3.86737,
          Size: 13461891
        },
        {
          Country: 'Saint Kitts and Nevis',
          'GDP per capita': 26485.816,
          'Life expectancy at birth': 71.7,
          'Fertility rate': 1.5307,
          'Child mortality rate': 1.09988,
          Size: 47631
        },
        {
          Country: 'Saint Lucia',
          'GDP per capita': 13045.955,
          'Life expectancy at birth': 71.1,
          'Fertility rate': 1.399,
          'Child mortality rate': 1.44284,
          Size: 179663
        },
        {
          Country: 'Saint Vincent and the Grenadines',
          'GDP per capita': 13695.039,
          'Life expectancy at birth': 69.6,
          'Fertility rate': 1.7971,
          'Child mortality rate': 1.40908,
          Size: 104340
        },
        {
          Country: 'Sao Tome and Principe',
          'GDP per capita': 4052.1233,
          'Life expectancy at birth': 67.6,
          'Fertility rate': 3.8226,
          'Child mortality rate': 1.4605,
          Size: 223118
        },
        {
          Country: 'Saudi Arabia',
          'GDP per capita': 44339.312,
          'Life expectancy at birth': 76.9,
          'Fertility rate': 2.4266,
          'Child mortality rate': 0.68990004,
          Size: 35950396
        },
        {
          Country: 'Senegal',
          'GDP per capita': 3495.4036,
          'Life expectancy at birth': 67.1,
          'Fertility rate': 4.3871,
          'Child mortality rate': 3.6707,
          Size: 16876726
        },
        {
          Country: 'Seychelles',
          'GDP per capita': 28760.516,
          'Life expectancy at birth': 71.3,
          'Fertility rate': 2.3484,
          'Child mortality rate': 1.3638799,
          Size: 106486
        },
        {
          Country: 'Sierra Leone',
          'GDP per capita': 1614.6981,
          'Life expectancy at birth': 60.1,
          'Fertility rate': 3.9779,
          'Child mortality rate': 9.950319,
          Size: 8420642
        },
        {
          Country: 'Singapore',
          'GDP per capita': 106032.23,
          'Life expectancy at birth': 82.8,
          'Fertility rate': 1.0243,
          'Child mortality rate': 0.20560999,
          Size: 5941063
        },
        {
          Country: 'Slovakia',
          'GDP per capita': 31866.025,
          'Life expectancy at birth': 74.9,
          'Fertility rate': 1.5664,
          'Child mortality rate': 0.58063996,
          Size: 5447621
        },
        {
          Country: 'Slovenia',
          'GDP per capita': 40036.484,
          'Life expectancy at birth': 80.7,
          'Fertility rate': 1.6272,
          'Child mortality rate': 0.23640999,
          Size: 2119408
        },
        {
          Country: 'Solomon Islands',
          'GDP per capita': 2406.1135,
          'Life expectancy at birth': 70.3,
          'Fertility rate': 3.9832,
          'Child mortality rate': 1.87301,
          Size: 707855
        },
        {
          Country: 'Somalia',
          'GDP per capita': 1136.736,
          'Life expectancy at birth': 55.3,
          'Fertility rate': 6.3123,
          'Child mortality rate': 11.18507,
          Size: 17065588
        },
        {
          Country: 'South Africa',
          'GDP per capita': 13311.926,
          'Life expectancy at birth': 62.3,
          'Fertility rate': 2.374,
          'Child mortality rate': 3.50681,
          Size: 59392256
        },
        {
          Country: 'South Korea',
          'GDP per capita': 44232.207,
          'Life expectancy at birth': 83.7,
          'Fertility rate': 0.8799,
          'Child mortality rate': 0.29209,
          Size: 51830136
        },
        {
          Country: 'Spain',
          'GDP per capita': 37913.074,
          'Life expectancy at birth': 83,
          'Fertility rate': 1.2779,
          'Child mortality rate': 0.29862002,
          Size: 47486932
        },
        {
          Country: 'Sri Lanka',
          'GDP per capita': 13386.682,
          'Life expectancy at birth': 76.4,
          'Fertility rate': 1.9899,
          'Child mortality rate': 0.67038,
          Size: 21773438
        },
        {
          Country: 'Sudan',
          'GDP per capita': 3701.069,
          'Life expectancy at birth': 65.3,
          'Fertility rate': 4.4574,
          'Child mortality rate': 5.47112,
          Size: 45657204
        },
        {
          Country: 'Suriname',
          'GDP per capita': 14766.748,
          'Life expectancy at birth': 70.3,
          'Fertility rate': 2.3482,
          'Child mortality rate': 1.7073,
          Size: 612989
        },
        {
          Country: 'Sweden',
          'GDP per capita': 53613.42,
          'Life expectancy at birth': 83,
          'Fertility rate': 1.67,
          'Child mortality rate': 0.23731,
          Size: 10467095
        },
        {
          Country: 'Tajikistan',
          'GDP per capita': 3903.32,
          'Life expectancy at birth': 71.6,
          'Fertility rate': 3.1855,
          'Child mortality rate': 3.13161,
          Size: 9750078
        },
        {
          Country: 'Tanzania',
          'GDP per capita': 2581.6997,
          'Life expectancy at birth': 66.2,
          'Fertility rate': 4.7259,
          'Child mortality rate': 4.5864897,
          Size: 63588332
        },
        {
          Country: 'Thailand',
          'GDP per capita': 17077.043,
          'Life expectancy at birth': 78.7,
          'Fertility rate': 1.3305,
          'Child mortality rate': 0.83185995,
          Size: 71601104
        },
        {
          Country: 'Togo',
          'GDP per capita': 2124.8042,
          'Life expectancy at birth': 61.6,
          'Fertility rate': 4.2574,
          'Child mortality rate': 6.23662,
          Size: 8644829
        },
        {
          Country: 'Tonga',
          'GDP per capita': 6142.857,
          'Life expectancy at birth': 71,
          'Fertility rate': 3.2367,
          'Child mortality rate': 1.13757,
          Size: 106034
        },
        {
          Country: 'Trinidad and Tobago',
          'GDP per capita': 23037.143,
          'Life expectancy at birth': 73,
          'Fertility rate': 1.6263,
          'Child mortality rate': 1.67332,
          Size: 1525671
        },
        {
          Country: 'Tunisia',
          'GDP per capita': 10397.944,
          'Life expectancy at birth': 73.8,
          'Fertility rate': 2.0859,
          'Child mortality rate': 1.63162,
          Size: 12262949
        },
        {
          Country: 'Turkey',
          'GDP per capita': 31466.56,
          'Life expectancy at birth': 76,
          'Fertility rate': 1.8892,
          'Child mortality rate': 0.89898,
          Size: 84775408
        },
        {
          Country: 'Turks and Caicos Islands',
          'GDP per capita': 18512.457,
          'Life expectancy at birth': 74.6,
          'Fertility rate': 1.6691,
          'Child mortality rate': 1.41906,
          Size: 45141
        },
        {
          Country: 'Tuvalu',
          'GDP per capita': 4924.0273,
          'Life expectancy at birth': 64.5,
          'Fertility rate': 3.1635,
          'Child mortality rate': 2.12823,
          Size: 11229
        },
        {
          Country: 'Uganda',
          'GDP per capita': 2246.414,
          'Life expectancy at birth': 62.7,
          'Fertility rate': 4.5845,
          'Child mortality rate': 4.16203,
          Size: 45853780
        },
        {
          Country: 'Ukraine',
          'GDP per capita': 12943.614,
          'Life expectancy at birth': 71.6,
          'Fertility rate': 1.2507,
          'Child mortality rate': 0.65102,
          Size: 43531424
        },
        {
          Country: 'United Arab Emirates',
          'GDP per capita': 69733.8,
          'Life expectancy at birth': 78.7,
          'Fertility rate': 1.4597,
          'Child mortality rate': 0.65115,
          Size: 9365149
        },
        {
          Country: 'United Kingdom',
          'GDP per capita': 44978.715,
          'Life expectancy at birth': 80.7,
          'Fertility rate': 1.562,
          'Child mortality rate': 0.40983,
          Size: 67281040
        },
        {
          Country: 'United States',
          'GDP per capita': 63669.71,
          'Life expectancy at birth': 77.2,
          'Fertility rate': 1.6619,
          'Child mortality rate': 0.62975997,
          Size: 336997632
        },
        {
          Country: 'Uruguay',
          'GDP per capita': 22800.69,
          'Life expectancy at birth': 75.4,
          'Fertility rate': 1.4927,
          'Child mortality rate': 0.55899,
          Size: 3426265
        },
        {
          Country: 'Uzbekistan',
          'GDP per capita': 7734.8325,
          'Life expectancy at birth': 70.9,
          'Fertility rate': 2.8565,
          'Child mortality rate': 1.31621,
          Size: 34081452
        },
        {
          Country: 'Vanuatu',
          'GDP per capita': 2783.0195,
          'Life expectancy at birth': 70.4,
          'Fertility rate': 3.7355,
          'Child mortality rate': 2.44538,
          Size: 319146
        },
        {
          Country: 'Vietnam',
          'GDP per capita': 10628.219,
          'Life expectancy at birth': 73.6,
          'Fertility rate': 1.9437,
          'Child mortality rate': 2.0830798,
          Size: 97468024
        },
        {
          Country: 'Zambia',
          'GDP per capita': 3236.789,
          'Life expectancy at birth': 61.2,
          'Fertility rate': 4.308,
          'Child mortality rate': 5.7186003,
          Size: 19473132
        },
        {
          Country: 'Zimbabwe',
          'GDP per capita': 2115.1445,
          'Life expectancy at birth': 59.3,
          'Fertility rate': 3.4908,
          'Child mortality rate': 5.2148,
          Size: 15993525
        },
        {
          Country: 'Japan',
          'GDP per capita': 40784.383,
          'Life expectancy at birth': 84.8,
          'Fertility rate': 1.2974,
          'Child mortality rate': 0.24186,
          Size: 124612528
        },
        {
          Country: 'Kazakhstan',
          'GDP per capita': 26110.53,
          'Life expectancy at birth': 69.4,
          'Fertility rate': 3.0836,
          'Child mortality rate': 0.99076,
          Size: 19196468
        },
        {
          Country: 'Mexico',
          'GDP per capita': 19086.105,
          'Life expectancy at birth': 70.2,
          'Fertility rate': 1.8223,
          'Child mortality rate': 1.35515,
          Size: 126705136
        },
        {
          Country: 'Norway',
          'GDP per capita': 65662.17,
          'Life expectancy at birth': 83.2,
          'Fertility rate': 1.5034,
          'Child mortality rate': 0.24258001,
          Size: 5403021
        },
        {
          Country: 'Armenia',
          'GDP per capita': 14193.117,
          'Life expectancy at birth': 72,
          'Fertility rate': 1.575,
          'Child mortality rate': 1.04387,
          Size: 2790971
        },
        {
          Country: 'Azerbaijan',
          'GDP per capita': 14431.661,
          'Life expectancy at birth': 69.4,
          'Fertility rate': 1.6638,
          'Child mortality rate': 1.86127,
          Size: 10312992
        },
        {
          Country: 'Cyprus',
          'GDP per capita': 41701.703,
          'Life expectancy at birth': 81.2,
          'Fertility rate': 1.3208,
          'Child mortality rate': 0.27108,
          Size: 1244193
        },
        {
          Country: 'Laos',
          'GDP per capita': 7846.975,
          'Life expectancy at birth': 68.1,
          'Fertility rate': 2.4961,
          'Child mortality rate': 4.25943,
          Size: 7425055
        },
        {
          Country: 'Russia',
          'GDP per capita': 27960.102,
          'Life expectancy at birth': 69.4,
          'Fertility rate': 1.4927,
          'Child mortality rate': 0.48901,
          Size: 145102752
        },
        {
          Country: 'Turkey',
          'GDP per capita': 31466.56,
          'Life expectancy at birth': 76,
          'Fertility rate': 1.8892,
          'Child mortality rate': 0.89898,
          Size: 84775408
        },
        {
          Country: 'East Timor',
          'GDP per capita': 5032.41,
          'Life expectancy at birth': 67.7,
          'Fertility rate': 3.1486,
          'Child mortality rate': 4.11491,
          Size: 1320944
        },
        {
          Country: 'Ecuador',
          'GDP per capita': 10668.758,
          'Life expectancy at birth': 73.7,
          'Fertility rate': 2.0256,
          'Child mortality rate': 1.24514,
          Size: 17797736
        },
        {
          Country: 'El Salvador',
          'GDP per capita': 9086.047,
          'Life expectancy at birth': 70.7,
          'Fertility rate': 1.8031,
          'Child mortality rate': 1.26651,
          Size: 6314165
        },
        {
          Country: 'Georgia',
          'GDP per capita': 15486.659,
          'Life expectancy at birth': 71.7,
          'Fertility rate': 2.0813,
          'Child mortality rate': 0.90087,
          Size: 3757984
        },
        {
          Country: 'Germany',
          'GDP per capita': 53179.656,
          'Life expectancy at birth': 80.6,
          'Fertility rate': 1.53,
          'Child mortality rate': 0.36256,
          Size: 83408560
        },
        {
          Country: 'Haiti',
          'GDP per capita': 2870.145,
          'Life expectancy at birth': 63.2,
          'Fertility rate': 2.8143,
          'Child mortality rate': 6.01092,
          Size: 11447575
        },
        {
          Country: 'Honduras',
          'GDP per capita': 5572.177,
          'Life expectancy at birth': 70.1,
          'Fertility rate': 2.363,
          'Child mortality rate': 1.6172899,
          Size: 10278346
        },
        {
          Country: 'Iran',
          'GDP per capita': 15004.6875,
          'Life expectancy at birth': 73.9,
          'Fertility rate': 1.6919,
          'Child mortality rate': 1.26375,
          Size: 87923432
        },
        {
          Country: 'Kazakhstan',
          'GDP per capita': 26110.53,
          'Life expectancy at birth': 69.4,
          'Fertility rate': 3.0836,
          'Child mortality rate': 0.99076,
          Size: 19196468
        },
        {
          Country: 'Malaysia',
          'GDP per capita': 26333.156,
          'Life expectancy at birth': 74.9,
          'Fertility rate': 1.803,
          'Child mortality rate': 0.86048,
          Size: 33573872
        },
        {
          Country: 'Maldives',
          'GDP per capita': 18765.217,
          'Life expectancy at birth': 79.9,
          'Fertility rate': 1.6916,
          'Child mortality rate': 0.60084,
          Size: 521469
        },
        {
          Country: 'Mauritania',
          'GDP per capita': 5307.522,
          'Life expectancy at birth': 64.4,
          'Fertility rate': 4.3976,
          'Child mortality rate': 6.09523,
          Size: 4614981
        },
        {
          Country: 'Poland',
          'GDP per capita': 34915.523,
          'Life expectancy at birth': 76.5,
          'Fertility rate': 1.4587,
          'Child mortality rate': 0.40288,
          Size: 38307724
        },
        {
          Country: 'Puerto Rico',
          'GDP per capita': 32632.883,
          'Life expectancy at birth': 80.2,
          'Fertility rate': 1.2925,
          'Child mortality rate': 0.75082004,
          Size: 3256030
        },
        {
          Country: 'Samoa',
          'GDP per capita': 5534.127,
          'Life expectancy at birth': 72.8,
          'Fertility rate': 3.9301,
          'Child mortality rate': 1.67608,
          Size: 218781
        },
        {
          Country: 'Serbia',
          'GDP per capita': 19831.297,
          'Life expectancy at birth': 74.2,
          'Fertility rate': 1.5278,
          'Child mortality rate': 0.5704,
          Size: 7296771
        },
        {
          Country: 'Switzerland',
          'GDP per capita': 71032.84,
          'Life expectancy at birth': 84,
          'Fertility rate': 1.4946,
          'Child mortality rate': 0.36673,
          Size: 8691409
        },
        {
          Country: 'Georgia',
          'GDP per capita': 15486.659,
          'Life expectancy at birth': 71.7,
          'Fertility rate': 2.0813,
          'Child mortality rate': 0.90087,
          Size: 3757984
        }
      ]
    }
  ],
  axes: [
    {
      orient: 'left',
      id: 'axis-left',
      type: 'linear',
      label: {
        autoLimit: false,
        style: {
          fill: '#1F2329',
          fontSize: 16
        }
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000000'
        }
      },
      tick: {
        visible: true,
        style: {
          stroke: '#000000'
        }
      },
      grid: {
        visible: false,
        style: {
          stroke: '#bbbfc4',
          pickStrokeBuffer: 2
        }
      },
      autoIndent: false,
      maxWidth: null,
      maxHeight: null,
      visible: true
    },
    {
      orient: 'bottom',
      id: 'axis-bottom',
      type: 'linear',
      label: {
        autoLimit: false,
        style: {
          fill: '#1F2329',
          fontSize: 16
        },
        formatMethod: null
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000000'
        }
      },
      tick: {
        visible: true,
        style: {
          stroke: '#000000'
        }
      },
      grid: {
        visible: false,
        style: {
          stroke: '#bbbfc4',
          pickStrokeBuffer: 2
        }
      },
      autoIndent: false,
      maxWidth: null,
      maxHeight: null,
      visible: true
    }
  ],
  markLine: [
    {
      endSymbol: {
        visible: false
      },
      startSymbol: {
        visible: false
      },
      label: {
        visible: false
      },
      line: {
        style: {
          stroke: '#f54a45',
          lineWidth: 1,
          pickStrokeBuffer: 10,
          lineDash: [0, 0],
          visible: true
        }
      },
      regionRelative: true,
      positions: (data, series) => {
        const points = data
          .map(datum => {
            const point = series.dataToPosition(datum);
            return [point.x, point.y];
          })
          .sort((a, b) => a[0] - b[0]);
        const regressionResult = logarithmic(points, { precision: 2 });
        return regressionResult.points.map(point => {
          return {
            x: point[0],
            y: point[1]
          };
        });
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
