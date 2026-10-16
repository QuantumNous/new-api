---
category: demo
group: legend
title: 多图例/混合图例
keywords: scatterChart,comparison,distribution,scatter,legend
order: 27-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/multiple-legends.png
option: scatterChart#legends
---

# 多图例/混合图例

## 关键配置

`legends` 配置项支持数组，可以配置多个图例。

## 代码演示

```javascript livedemo
const data = [
  {
    continent: 'Africa',
    Country: 'Algeria',
    LifeExpectancy: 72.301,
    GDP: 6223.367465,
    Population: 33333216.0
  },
  {
    continent: 'Africa',
    Country: 'Angola',
    LifeExpectancy: 42.731,
    GDP: 4797.231267,
    Population: 12420476.0
  },
  {
    continent: 'Africa',
    Country: 'Benin',
    LifeExpectancy: 56.728,
    GDP: 1441.284873,
    Population: 8078314.0
  },
  {
    continent: 'Africa',
    Country: 'Botswana',
    LifeExpectancy: 50.728,
    GDP: 12569.85177,
    Population: 1639131.0
  },
  {
    continent: 'Africa',
    Country: 'Burkina Faso',
    LifeExpectancy: 52.295,
    GDP: 1217.032994,
    Population: 14326203.0
  },
  {
    continent: 'Africa',
    Country: 'Burundi',
    LifeExpectancy: 49.58,
    GDP: 430.0706916,
    Population: 8390505.0
  },
  {
    continent: 'Africa',
    Country: 'Cameroon',
    LifeExpectancy: 50.43,
    GDP: 2042.09524,
    Population: 17696293.0
  },
  {
    continent: 'Africa',
    Country: 'Central African Republic',
    LifeExpectancy: 44.741,
    GDP: 706.016537,
    Population: 4369038.0
  },
  {
    continent: 'Africa',
    Country: 'Chad',
    LifeExpectancy: 50.651,
    GDP: 1704.063724,
    Population: 10238807.0
  },
  {
    continent: 'Africa',
    Country: 'Comoros',
    LifeExpectancy: 65.152,
    GDP: 986.1478792,
    Population: 710960.0
  },
  {
    continent: 'Africa',
    Country: 'Congo, Dem. Rep.',
    LifeExpectancy: 46.462,
    GDP: 277.5518587,
    Population: 64606759.0
  },
  {
    continent: 'Africa',
    Country: 'Congo, Rep.',
    LifeExpectancy: 55.322,
    GDP: 3632.557798,
    Population: 3800610.0
  },
  {
    continent: 'Africa',
    Country: "Cote d'Ivoire",
    LifeExpectancy: 48.328,
    GDP: 1544.750112,
    Population: 18013409.0
  },
  {
    continent: 'Africa',
    Country: 'Djibouti',
    LifeExpectancy: 54.791,
    GDP: 2082.481567,
    Population: 496374.0
  },
  {
    continent: 'Africa',
    Country: 'Egypt',
    LifeExpectancy: 71.338,
    GDP: 5581.180998,
    Population: 80264543.0
  },
  {
    continent: 'Africa',
    Country: 'Equatorial Guinea',
    LifeExpectancy: 51.579,
    GDP: 12154.08975,
    Population: 551201.0
  },
  {
    continent: 'Africa',
    Country: 'Eritrea',
    LifeExpectancy: 58.04,
    GDP: 641.3695236,
    Population: 4906585.0
  },
  {
    continent: 'Africa',
    Country: 'Ethiopia',
    LifeExpectancy: 52.947,
    GDP: 690.8055759,
    Population: 76511887.0
  },
  {
    continent: 'Africa',
    Country: 'Gabon',
    LifeExpectancy: 56.735,
    GDP: 13206.48452,
    Population: 1454867.0
  },
  {
    continent: 'Africa',
    Country: 'Gambia',
    LifeExpectancy: 59.448,
    GDP: 752.7497265,
    Population: 1688359.0
  },
  {
    continent: 'Africa',
    Country: 'Ghana',
    LifeExpectancy: 60.022,
    GDP: 1327.60891,
    Population: 22873338.0
  },
  {
    continent: 'Africa',
    Country: 'Guinea',
    LifeExpectancy: 56.007,
    GDP: 942.6542111,
    Population: 9947814.0
  },
  {
    continent: 'Africa',
    Country: 'Guinea-Bissau',
    LifeExpectancy: 46.388,
    GDP: 579.231743,
    Population: 1472041.0
  },
  {
    continent: 'Africa',
    Country: 'Kenya',
    LifeExpectancy: 54.11,
    GDP: 1463.249282,
    Population: 35610177.0
  },
  {
    continent: 'Africa',
    Country: 'Lesotho',
    LifeExpectancy: 42.592,
    GDP: 1569.331442,
    Population: 2012649.0
  },
  {
    continent: 'Africa',
    Country: 'Liberia',
    LifeExpectancy: 45.678,
    GDP: 414.5073415,
    Population: 3193942.0
  },
  {
    continent: 'Africa',
    Country: 'Libya',
    LifeExpectancy: 73.952,
    GDP: 12057.49928,
    Population: 6036914.0
  },
  {
    continent: 'Africa',
    Country: 'Madagascar',
    LifeExpectancy: 59.443,
    GDP: 1044.770126,
    Population: 19167654.0
  },
  {
    continent: 'Africa',
    Country: 'Malawi',
    LifeExpectancy: 48.303,
    GDP: 759.3499101,
    Population: 13327079.0
  },
  {
    continent: 'Africa',
    Country: 'Mali',
    LifeExpectancy: 54.467,
    GDP: 1042.581557,
    Population: 12031795.0
  },
  {
    continent: 'Africa',
    Country: 'Mauritania',
    LifeExpectancy: 64.164,
    GDP: 1803.151496,
    Population: 3270065.0
  },
  {
    continent: 'Africa',
    Country: 'Mauritius',
    LifeExpectancy: 72.801,
    GDP: 10956.99112,
    Population: 1250882.0
  },
  {
    continent: 'Africa',
    Country: 'Morocco',
    LifeExpectancy: 71.164,
    GDP: 3820.17523,
    Population: 33757175.0
  },
  {
    continent: 'Africa',
    Country: 'Mozambique',
    LifeExpectancy: 42.082,
    GDP: 823.6856205,
    Population: 19951656.0
  },
  {
    continent: 'Africa',
    Country: 'Namibia',
    LifeExpectancy: 52.906,
    GDP: 4811.060429,
    Population: 2055080.0
  },
  {
    continent: 'Africa',
    Country: 'Niger',
    LifeExpectancy: 56.867,
    GDP: 619.6768924,
    Population: 12894865.0
  },
  {
    continent: 'Africa',
    Country: 'Nigeria',
    LifeExpectancy: 46.859,
    GDP: 2013.977305,
    Population: 135031164.0
  },
  {
    continent: 'Africa',
    Country: 'Reunion',
    LifeExpectancy: 76.442,
    GDP: 7670.122558,
    Population: 798094.0
  },
  {
    continent: 'Africa',
    Country: 'Rwanda',
    LifeExpectancy: 46.242,
    GDP: 863.0884639,
    Population: 8860588.0
  },
  {
    continent: 'Africa',
    Country: 'Sao Tome and Principe',
    LifeExpectancy: 65.528,
    GDP: 1598.435089,
    Population: 199579.0
  },
  {
    continent: 'Africa',
    Country: 'Senegal',
    LifeExpectancy: 63.062,
    GDP: 1712.472136,
    Population: 12267493.0
  },
  {
    continent: 'Africa',
    Country: 'Sierra Leone',
    LifeExpectancy: 42.568,
    GDP: 862.5407561,
    Population: 6144562.0
  },
  {
    continent: 'Africa',
    Country: 'Somalia',
    LifeExpectancy: 48.159,
    GDP: 926.1410683,
    Population: 9118773.0
  },
  {
    continent: 'Africa',
    Country: 'South Africa',
    LifeExpectancy: 49.339,
    GDP: 9269.657808,
    Population: 43997828.0
  },
  {
    continent: 'Africa',
    Country: 'Sudan',
    LifeExpectancy: 58.556,
    GDP: 2602.394995,
    Population: 42292929.0
  },
  {
    continent: 'Africa',
    Country: 'Swaziland',
    LifeExpectancy: 39.613,
    GDP: 4513.480643,
    Population: 1133066.0
  },
  {
    continent: 'Africa',
    Country: 'Tanzania',
    LifeExpectancy: 52.517,
    GDP: 1107.482182,
    Population: 38139640.0
  },
  {
    continent: 'Africa',
    Country: 'Togo',
    LifeExpectancy: 58.42,
    GDP: 882.9699438,
    Population: 5701579.0
  },
  {
    continent: 'Africa',
    Country: 'Tunisia',
    LifeExpectancy: 73.923,
    GDP: 7092.923025,
    Population: 10276158.0
  },
  {
    continent: 'Africa',
    Country: 'Uganda',
    LifeExpectancy: 51.542,
    GDP: 1056.380121,
    Population: 29170398.0
  },
  {
    continent: 'Africa',
    Country: 'Zambia',
    LifeExpectancy: 42.384,
    GDP: 1271.211593,
    Population: 11746035.0
  },
  {
    continent: 'Africa',
    Country: 'Zimbabwe',
    LifeExpectancy: 43.487,
    GDP: 469.7092981,
    Population: 12311143.0
  },
  {
    continent: 'Americas',
    Country: 'Argentina',
    LifeExpectancy: 75.32,
    GDP: 12779.37964,
    Population: 40301927.0
  },
  {
    continent: 'Americas',
    Country: 'Bolivia',
    LifeExpectancy: 65.554,
    GDP: 3822.137084,
    Population: 9119152.0
  },
  {
    continent: 'Americas',
    Country: 'Brazil',
    LifeExpectancy: 72.39,
    GDP: 9065.800825,
    Population: 190010647.0
  },
  {
    continent: 'Americas',
    Country: 'Canada',
    LifeExpectancy: 80.653,
    GDP: 36319.23501,
    Population: 33390141.0
  },
  {
    continent: 'Americas',
    Country: 'Chile',
    LifeExpectancy: 78.553,
    GDP: 13171.63885,
    Population: 16284741.0
  },
  {
    continent: 'Americas',
    Country: 'Colombia',
    LifeExpectancy: 72.889,
    GDP: 7006.580419,
    Population: 44227550.0
  },
  {
    continent: 'Americas',
    Country: 'Costa Rica',
    LifeExpectancy: 78.782,
    GDP: 9645.06142,
    Population: 4133884.0
  },
  {
    continent: 'Americas',
    Country: 'Cuba',
    LifeExpectancy: 78.273,
    GDP: 8948.102923,
    Population: 11416987.0
  },
  {
    continent: 'Americas',
    Country: 'Dominican Republic',
    LifeExpectancy: 72.235,
    GDP: 6025.374752,
    Population: 9319622.0
  },
  {
    continent: 'Americas',
    Country: 'Ecuador',
    LifeExpectancy: 74.994,
    GDP: 6873.262326,
    Population: 13755680.0
  },
  {
    continent: 'Americas',
    Country: 'El Salvador',
    LifeExpectancy: 71.878,
    GDP: 5728.353514,
    Population: 6939688.0
  },
  {
    continent: 'Americas',
    Country: 'Guatemala',
    LifeExpectancy: 70.259,
    GDP: 5186.050003,
    Population: 12572928.0
  },
  {
    continent: 'Americas',
    Country: 'Haiti',
    LifeExpectancy: 60.916,
    GDP: 1201.637154,
    Population: 8502814.0
  },
  {
    continent: 'Americas',
    Country: 'Honduras',
    LifeExpectancy: 70.198,
    GDP: 3548.330846,
    Population: 7483763.0
  },
  {
    continent: 'Americas',
    Country: 'Jamaica',
    LifeExpectancy: 72.567,
    GDP: 7320.880262,
    Population: 2780132.0
  },
  {
    continent: 'Americas',
    Country: 'Mexico',
    LifeExpectancy: 76.195,
    GDP: 11977.57496,
    Population: 108700891.0
  },
  {
    continent: 'Americas',
    Country: 'Nicaragua',
    LifeExpectancy: 72.899,
    GDP: 2749.320965,
    Population: 5675356.0
  },
  {
    continent: 'Americas',
    Country: 'Panama',
    LifeExpectancy: 75.537,
    GDP: 9809.185636,
    Population: 3242173.0
  },
  {
    continent: 'Americas',
    Country: 'Paraguay',
    LifeExpectancy: 71.752,
    GDP: 4172.838464,
    Population: 6667147.0
  },
  {
    continent: 'Americas',
    Country: 'Peru',
    LifeExpectancy: 71.421,
    GDP: 7408.905561,
    Population: 28674757.0
  },
  {
    continent: 'Americas',
    Country: 'Puerto Rico',
    LifeExpectancy: 78.746,
    GDP: 19328.70901,
    Population: 3942491.0
  },
  {
    continent: 'Americas',
    Country: 'Trinidad and Tobago',
    LifeExpectancy: 69.819,
    GDP: 18008.50924,
    Population: 1056608.0
  },
  {
    continent: 'Americas',
    Country: 'United States',
    LifeExpectancy: 78.242,
    GDP: 42951.65309,
    Population: 301139947.0
  },
  {
    continent: 'Americas',
    Country: 'Uruguay',
    LifeExpectancy: 76.384,
    GDP: 10611.46299,
    Population: 3447496.0
  },
  {
    continent: 'Americas',
    Country: 'Venezuela',
    LifeExpectancy: 73.747,
    GDP: 11415.80569,
    Population: 26084662.0
  },
  {
    continent: 'Asia',
    Country: 'Afghanistan',
    LifeExpectancy: 43.828,
    GDP: 974.5803384,
    Population: 31889923.0
  },
  {
    continent: 'Asia',
    Country: 'Bahrain',
    LifeExpectancy: 75.635,
    GDP: 29796.04834,
    Population: 708573.0
  },
  {
    continent: 'Asia',
    Country: 'Bangladesh',
    LifeExpectancy: 64.062,
    GDP: 1391.253792,
    Population: 150448339.0
  },
  {
    continent: 'Asia',
    Country: 'Cambodia',
    LifeExpectancy: 59.723,
    GDP: 1713.778686,
    Population: 14131858.0
  },
  {
    continent: 'Asia',
    Country: 'China',
    LifeExpectancy: 72.961,
    GDP: 4959.114854,
    Population: 1318683096.0
  },
  {
    continent: 'Asia',
    Country: 'Hong Kong, China',
    LifeExpectancy: 82.208,
    GDP: 39724.97867,
    Population: 6980412.0
  },
  {
    continent: 'Asia',
    Country: 'India',
    LifeExpectancy: 64.698,
    GDP: 2452.210407,
    Population: 1110396331.0
  },
  {
    continent: 'Asia',
    Country: 'Indonesia',
    LifeExpectancy: 70.65,
    GDP: 3540.651564,
    Population: 223547000.0
  },
  {
    continent: 'Asia',
    Country: 'Iran',
    LifeExpectancy: 70.964,
    GDP: 11605.71449,
    Population: 69453570.0
  },
  {
    continent: 'Asia',
    Country: 'Iraq',
    LifeExpectancy: 59.545,
    GDP: 4471.061906,
    Population: 27499638.0
  },
  {
    continent: 'Asia',
    Country: 'Israel',
    LifeExpectancy: 80.745,
    GDP: 25523.2771,
    Population: 6426679.0
  },
  {
    continent: 'Asia',
    Country: 'Japan',
    LifeExpectancy: 82.603,
    GDP: 31656.06806,
    Population: 127467972.0
  },
  {
    continent: 'Asia',
    Country: 'Jordan',
    LifeExpectancy: 72.535,
    GDP: 4519.461171,
    Population: 6053193.0
  },
  {
    continent: 'Asia',
    Country: 'Korea, Dem. Rep.',
    LifeExpectancy: 67.297,
    GDP: 1593.06548,
    Population: 23301725.0
  },
  {
    continent: 'Asia',
    Country: 'Korea, Rep.',
    LifeExpectancy: 78.623,
    GDP: 23348.13973,
    Population: 49044790.0
  },
  {
    continent: 'Asia',
    Country: 'Lebanon',
    LifeExpectancy: 71.993,
    GDP: 10461.05868,
    Population: 3921278.0
  },
  {
    continent: 'Asia',
    Country: 'Malaysia',
    LifeExpectancy: 74.241,
    GDP: 12451.6558,
    Population: 24821286.0
  },
  {
    continent: 'Asia',
    Country: 'Mongolia',
    LifeExpectancy: 66.803,
    GDP: 3095.772271,
    Population: 2874127.0
  },
  {
    continent: 'Asia',
    Country: 'Myanmar',
    LifeExpectancy: 62.069,
    GDP: 944.0,
    Population: 47761980.0
  },
  {
    continent: 'Asia',
    Country: 'Nepal',
    LifeExpectancy: 63.785,
    GDP: 1091.359778,
    Population: 28901790.0
  },
  {
    continent: 'Asia',
    Country: 'Oman',
    LifeExpectancy: 75.64,
    GDP: 22316.19287,
    Population: 3204897.0
  },
  {
    continent: 'Asia',
    Country: 'Pakistan',
    LifeExpectancy: 65.483,
    GDP: 2605.94758,
    Population: 169270617.0
  },
  {
    continent: 'Asia',
    Country: 'Philippines',
    LifeExpectancy: 71.688,
    GDP: 3190.481016,
    Population: 91077287.0
  },
  {
    continent: 'Asia',
    Country: 'Saudi Arabia',
    LifeExpectancy: 72.777,
    GDP: 21654.83194,
    Population: 27601038.0
  },
  {
    continent: 'Asia',
    Country: 'Singapore',
    LifeExpectancy: 79.972,
    GDP: 47143.17964,
    Population: 4553009.0
  },
  {
    continent: 'Asia',
    Country: 'Sri Lanka',
    LifeExpectancy: 72.396,
    GDP: 3970.095407,
    Population: 20378239.0
  },
  {
    continent: 'Asia',
    Country: 'Syria',
    LifeExpectancy: 74.143,
    GDP: 4184.548089,
    Population: 19314747.0
  },
  {
    continent: 'Asia',
    Country: 'Thailand',
    LifeExpectancy: 70.616,
    GDP: 7458.396327,
    Population: 65068149.0
  },
  {
    continent: 'Asia',
    Country: 'Vietnam',
    LifeExpectancy: 74.249,
    GDP: 2441.576404,
    Population: 85262356.0
  },
  {
    continent: 'Asia',
    Country: 'West Bank and Gaza',
    LifeExpectancy: 73.422,
    GDP: 3025.349798,
    Population: 4018332.0
  },
  {
    continent: 'Asia',
    Country: 'Yemen, Rep.',
    LifeExpectancy: 62.698,
    GDP: 2280.769906,
    Population: 22211743.0
  },
  {
    continent: 'Europe',
    Country: 'Albania',
    LifeExpectancy: 76.423,
    GDP: 5937.029526,
    Population: 3600523.0
  },
  {
    continent: 'Europe',
    Country: 'Austria',
    LifeExpectancy: 79.829,
    GDP: 36126.4927,
    Population: 8199783.0
  },
  {
    continent: 'Europe',
    Country: 'Belgium',
    LifeExpectancy: 79.441,
    GDP: 33692.60508,
    Population: 10392226.0
  },
  {
    continent: 'Europe',
    Country: 'Bosnia and Herzegovina',
    LifeExpectancy: 74.852,
    GDP: 7446.298803,
    Population: 4552198.0
  },
  {
    continent: 'Europe',
    Country: 'Bulgaria',
    LifeExpectancy: 73.005,
    GDP: 10680.79282,
    Population: 7322858.0
  },
  {
    continent: 'Europe',
    Country: 'Croatia',
    LifeExpectancy: 75.748,
    GDP: 14619.22272,
    Population: 4493312.0
  },
  {
    continent: 'Europe',
    Country: 'Czech Republic',
    LifeExpectancy: 76.486,
    GDP: 22833.30851,
    Population: 10228744.0
  },
  {
    continent: 'Europe',
    Country: 'Denmark',
    LifeExpectancy: 78.332,
    GDP: 35278.41874,
    Population: 5468120.0
  },
  {
    continent: 'Europe',
    Country: 'Finland',
    LifeExpectancy: 79.313,
    GDP: 33207.0844,
    Population: 5238460.0
  },
  {
    continent: 'Europe',
    Country: 'France',
    LifeExpectancy: 80.657,
    GDP: 30470.0167,
    Population: 61083916.0
  },
  {
    continent: 'Europe',
    Country: 'Germany',
    LifeExpectancy: 79.406,
    GDP: 32170.37442,
    Population: 82400996.0
  },
  {
    continent: 'Europe',
    Country: 'Greece',
    LifeExpectancy: 79.483,
    GDP: 27538.41188,
    Population: 10706290.0
  },
  {
    continent: 'Europe',
    Country: 'Hungary',
    LifeExpectancy: 73.338,
    GDP: 18008.94444,
    Population: 9956108.0
  },
  {
    continent: 'Europe',
    Country: 'Iceland',
    LifeExpectancy: 81.757,
    GDP: 36180.78919,
    Population: 301931.0
  },
  {
    continent: 'Europe',
    Country: 'Ireland',
    LifeExpectancy: 78.885,
    GDP: 40675.99635,
    Population: 4109086.0
  },
  {
    continent: 'Europe',
    Country: 'Italy',
    LifeExpectancy: 80.546,
    GDP: 28569.7197,
    Population: 58147733.0
  },
  {
    continent: 'Europe',
    Country: 'Montenegro',
    LifeExpectancy: 74.543,
    GDP: 9253.896111,
    Population: 684736.0
  },
  {
    continent: 'Europe',
    Country: 'Netherlands',
    LifeExpectancy: 79.762,
    GDP: 36797.93332,
    Population: 16570613.0
  },
  {
    continent: 'Europe',
    Country: 'Norway',
    LifeExpectancy: 80.196,
    GDP: 49357.19017,
    Population: 4627926.0
  },
  {
    continent: 'Europe',
    Country: 'Poland',
    LifeExpectancy: 75.563,
    GDP: 15389.92468,
    Population: 38518241.0
  },
  {
    continent: 'Europe',
    Country: 'Portugal',
    LifeExpectancy: 78.098,
    GDP: 20509.64777,
    Population: 10642836.0
  },
  {
    continent: 'Europe',
    Country: 'Romania',
    LifeExpectancy: 72.476,
    GDP: 10808.47561,
    Population: 22276056.0
  },
  {
    continent: 'Europe',
    Country: 'Serbia',
    LifeExpectancy: 74.002,
    GDP: 9786.534714,
    Population: 10150265.0
  },
  {
    continent: 'Europe',
    Country: 'Slovak Republic',
    LifeExpectancy: 74.663,
    GDP: 18678.31435,
    Population: 5447502.0
  },
  {
    continent: 'Europe',
    Country: 'Slovenia',
    LifeExpectancy: 77.926,
    GDP: 25768.25759,
    Population: 2009245.0
  },
  {
    continent: 'Europe',
    Country: 'Spain',
    LifeExpectancy: 80.941,
    GDP: 28821.0637,
    Population: 40448191.0
  },
  {
    continent: 'Europe',
    Country: 'Sweden',
    LifeExpectancy: 80.884,
    GDP: 33859.74835,
    Population: 9031088.0
  },
  {
    continent: 'Europe',
    Country: 'Switzerland',
    LifeExpectancy: 81.701,
    GDP: 37506.41907,
    Population: 7554661.0
  },
  {
    continent: 'Europe',
    Country: 'Turkey',
    LifeExpectancy: 71.777,
    GDP: 8458.276384,
    Population: 71158647.0
  },
  {
    continent: 'Europe',
    Country: 'United Kingdom',
    LifeExpectancy: 79.425,
    GDP: 33203.26128,
    Population: 60776238.0
  },
  {
    continent: 'Oceania',
    Country: 'Australia',
    LifeExpectancy: 81.235,
    GDP: 34435.36744,
    Population: 20434176.0
  },
  {
    continent: 'Oceania',
    Country: 'New Zealand',
    LifeExpectancy: 80.204,
    GDP: 25185.00911,
    Population: 4115771.0
  }
];
const spec = {
  type: 'scatter',
  data: {
    values: data
  },
  xField: 'GDP',
  yField: 'LifeExpectancy',
  sizeField: 'Population',
  size: {
    type: 'linear',
    range: [10, 70]
  },
  seriesField: 'continent',
  point: {
    style: {
      fillOpacity: 0.65
    }
  },
  axes: [
    {
      orient: 'bottom',
      type: 'linear',
      title: {
        visible: true
      },
      label: {
        formatMethod: value => {
          return `${(value / 1000).toFixed(0)}k`;
        }
      }
    },
    {
      orient: 'left',
      type: 'linear',
      min: 30,
      title: {
        visible: true
      }
    }
  ],
  legends: [
    {
      visible: true,
      orient: 'top',
      position: 'start',
      title: {
        visible: true,
        text: 'Continent'
      }
    },
    {
      visible: true,
      type: 'size',
      orient: 'bottom',
      position: 'start',
      field: 'Population',
      title: {
        visible: true,
        text: 'Population'
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
