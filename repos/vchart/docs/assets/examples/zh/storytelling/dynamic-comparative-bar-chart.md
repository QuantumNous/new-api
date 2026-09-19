---
category: examples
group: storytelling
title: 动态对比柱状图
keywords: barChart,comparison,animation,player
order: 36-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/dynamic-comparative-bar-chart.gif
option: commonChart
---

# 动态对比柱状图

## 关键配置

为了实现动态人口金字塔图，我们使用了组合图+布局的方式，具体配置如下：

- 网格布局，通过 `layout` 属性配置，用来进行柱状图的布局。
- 使用 `type: common` 类型，即组合图。
- `xAxis` 和 `yAxis` 的 `reverse` 属性，用来实现柱状图的反转。
- `player.specs` 配置了一系列用于播放的数据集合，通过`player.auto: true`配置自动播放。

## 代码演示

```javascript livedemo
const data = [
  {
    Year: 1950,
    Age: '0-4',
    Male: 8812.309,
    Female: 8424.578
  },
  {
    Year: 1950,
    Age: '10-14',
    Male: 5889.578,
    Female: 5684.493
  },
  {
    Year: 1950,
    Age: '15-19',
    Male: 5667.77,
    Female: 5549.266
  },
  {
    Year: 1950,
    Age: '20-24',
    Male: 6104.795,
    Female: 6144.93
  },
  {
    Year: 1950,
    Age: '25-29',
    Male: 6407.134,
    Female: 6464.906
  },
  {
    Year: 1950,
    Age: '30-34',
    Male: 6044.505,
    Female: 6098.963
  },
  {
    Year: 1950,
    Age: '35-39',
    Male: 5750.957,
    Female: 5811.561
  },
  {
    Year: 1950,
    Age: '40-44',
    Male: 5327.98,
    Female: 5354.257
  },
  {
    Year: 1950,
    Age: '45-49',
    Male: 4728.064,
    Female: 4754.626
  },
  {
    Year: 1950,
    Age: '5-9',
    Male: 7044.163,
    Female: 6740.604
  },
  {
    Year: 1950,
    Age: '50-54',
    Male: 4286.749,
    Female: 4349.461
  },
  {
    Year: 1950,
    Age: '55-59',
    Male: 3781.547,
    Female: 3853.162
  },
  {
    Year: 1950,
    Age: '60-64',
    Male: 3303.803,
    Female: 3381.455
  },
  {
    Year: 1950,
    Age: '65-69',
    Male: 2613.48,
    Female: 2871.965
  },
  {
    Year: 1950,
    Age: '70-74',
    Male: 1673.111,
    Female: 1867.607
  },
  {
    Year: 1950,
    Age: '75-79',
    Male: 1022.797,
    Female: 1193.194
  },
  {
    Year: 1950,
    Age: '80+',
    Male: 774.476,
    Female: 1026.151
  },
  {
    Year: 1951,
    Age: '0-4',
    Male: 9075.436,
    Female: 8685.233
  },
  {
    Year: 1951,
    Age: '10-14',
    Male: 6011.203,
    Female: 5815.572
  },
  {
    Year: 1951,
    Age: '15-19',
    Male: 5561.982,
    Female: 5493.489
  },
  {
    Year: 1951,
    Age: '20-24',
    Male: 5981.999,
    Female: 6010.068
  },
  {
    Year: 1951,
    Age: '25-29',
    Male: 6386.515,
    Female: 6447.413
  },
  {
    Year: 1951,
    Age: '30-34',
    Male: 6108.231,
    Female: 6164.392
  },
  {
    Year: 1951,
    Age: '35-39',
    Male: 5792.221,
    Female: 5857.793
  },
  {
    Year: 1951,
    Age: '40-44',
    Male: 5345.372,
    Female: 5392.897
  },
  {
    Year: 1951,
    Age: '45-49',
    Male: 4850.098,
    Female: 4886.427
  },
  {
    Year: 1951,
    Age: '5-9',
    Male: 7364.97,
    Female: 7039.553
  },
  {
    Year: 1951,
    Age: '50-54',
    Male: 4310.556,
    Female: 4398.53
  },
  {
    Year: 1951,
    Age: '55-59',
    Male: 3817.734,
    Female: 3920.236
  },
  {
    Year: 1951,
    Age: '60-64',
    Male: 3320.365,
    Female: 3424.095
  },
  {
    Year: 1951,
    Age: '65-69',
    Male: 2638.057,
    Female: 2907.784
  },
  {
    Year: 1951,
    Age: '70-74',
    Male: 1739.032,
    Female: 1963.945
  },
  {
    Year: 1951,
    Age: '75-79',
    Male: 1056.023,
    Female: 1243.894
  },
  {
    Year: 1951,
    Age: '80+',
    Male: 819.139,
    Female: 1074.795
  },
  {
    Year: 1952,
    Age: '0-4',
    Male: 9251.751,
    Female: 8859.371
  },
  {
    Year: 1952,
    Age: '10-14',
    Male: 6213.821,
    Female: 6003.309
  },
  {
    Year: 1952,
    Age: '15-19',
    Male: 5509.422,
    Female: 5483.395
  },
  {
    Year: 1952,
    Age: '20-24',
    Male: 5839.09,
    Female: 5876.943
  },
  {
    Year: 1952,
    Age: '25-29',
    Male: 6354.097,
    Female: 6407.438
  },
  {
    Year: 1952,
    Age: '30-34',
    Male: 6201.887,
    Female: 6259.146
  },
  {
    Year: 1952,
    Age: '35-39',
    Male: 5846.149,
    Female: 5908.5
  },
  {
    Year: 1952,
    Age: '40-44',
    Male: 5386.506,
    Female: 5449.44
  },
  {
    Year: 1952,
    Age: '45-49',
    Male: 4950.478,
    Female: 4996.97
  },
  {
    Year: 1952,
    Age: '5-9',
    Male: 7728.145,
    Female: 7377.521
  },
  {
    Year: 1952,
    Age: '50-54',
    Male: 4391.437,
    Female: 4491.698
  },
  {
    Year: 1952,
    Age: '55-59',
    Male: 3851.937,
    Female: 3984.469
  },
  {
    Year: 1952,
    Age: '60-64',
    Male: 3358.791,
    Female: 3493.18
  },
  {
    Year: 1952,
    Age: '65-69',
    Male: 2668.087,
    Female: 2938.896
  },
  {
    Year: 1952,
    Age: '70-74',
    Male: 1806.322,
    Female: 2074.025
  },
  {
    Year: 1952,
    Age: '75-79',
    Male: 1086.89,
    Female: 1286.812
  },
  {
    Year: 1952,
    Age: '80+',
    Male: 860.396,
    Female: 1128.519
  },
  {
    Year: 1953,
    Age: '0-4',
    Male: 9424.22,
    Female: 9028.126
  },
  {
    Year: 1953,
    Age: '10-14',
    Male: 6481.558,
    Female: 6237.124
  },
  {
    Year: 1953,
    Age: '15-19',
    Male: 5517.127,
    Female: 5510.838
  },
  {
    Year: 1953,
    Age: '20-24',
    Male: 5668.662,
    Female: 5750.624
  },
  {
    Year: 1953,
    Age: '25-29',
    Male: 6303.7,
    Female: 6338.519
  },
  {
    Year: 1953,
    Age: '30-34',
    Male: 6299.824,
    Female: 6359.158
  },
  {
    Year: 1953,
    Age: '35-39',
    Male: 5900.202,
    Female: 5955.19
  },
  {
    Year: 1953,
    Age: '40-44',
    Male: 5465.161,
    Female: 5535.539
  },
  {
    Year: 1953,
    Age: '45-49',
    Male: 4991.522,
    Female: 5052.532
  },
  {
    Year: 1953,
    Age: '5-9',
    Male: 8105.42,
    Female: 7733.801
  },
  {
    Year: 1953,
    Age: '50-54',
    Male: 4538.569,
    Female: 4637.507
  },
  {
    Year: 1953,
    Age: '55-59',
    Male: 3869.409,
    Female: 4034.149
  },
  {
    Year: 1953,
    Age: '60-64',
    Male: 3414.093,
    Female: 3577.431
  },
  {
    Year: 1953,
    Age: '65-69',
    Male: 2710.563,
    Female: 2979.879
  },
  {
    Year: 1953,
    Age: '70-74',
    Male: 1861.814,
    Female: 2179.002
  },
  {
    Year: 1953,
    Age: '75-79',
    Male: 1119.831,
    Female: 1330.291
  },
  {
    Year: 1953,
    Age: '80+',
    Male: 894.2,
    Female: 1182.597
  },
  {
    Year: 1954,
    Age: '0-4',
    Male: 9623.322,
    Female: 9221.285
  },
  {
    Year: 1954,
    Age: '10-14',
    Male: 6797.045,
    Female: 6507.73
  },
  {
    Year: 1954,
    Age: '15-19',
    Male: 5588.042,
    Female: 5575.134
  },
  {
    Year: 1954,
    Age: '20-24',
    Male: 5492.952,
    Female: 5644.446
  },
  {
    Year: 1954,
    Age: '25-29',
    Male: 6228.651,
    Female: 6245.767
  },
  {
    Year: 1954,
    Age: '30-34',
    Male: 6375.181,
    Female: 6435.146
  },
  {
    Year: 1954,
    Age: '35-39',
    Male: 5960.029,
    Female: 6007.318
  },
  {
    Year: 1954,
    Age: '40-44',
    Male: 5570.372,
    Female: 5640.363
  },
  {
    Year: 1954,
    Age: '45-49',
    Male: 4986.235,
    Female: 5064.221
  },
  {
    Year: 1954,
    Age: '5-9',
    Male: 8470.697,
    Female: 8084.911
  },
  {
    Year: 1954,
    Age: '50-54',
    Male: 4720.472,
    Female: 4810.798
  },
  {
    Year: 1954,
    Age: '55-59',
    Male: 3886.294,
    Female: 4081.799
  },
  {
    Year: 1954,
    Age: '60-64',
    Male: 3476.859,
    Female: 3664.188
  },
  {
    Year: 1954,
    Age: '65-69',
    Male: 2768.032,
    Female: 3042.452
  },
  {
    Year: 1954,
    Age: '70-74',
    Male: 1902.065,
    Female: 2265.096
  },
  {
    Year: 1954,
    Age: '75-79',
    Male: 1157.346,
    Female: 1384.685
  },
  {
    Year: 1954,
    Age: '80+',
    Male: 917.242,
    Female: 1231.435
  },
  {
    Year: 1955,
    Age: '0-4',
    Male: 9846.751,
    Female: 9436.316
  },
  {
    Year: 1955,
    Age: '10-14',
    Male: 7144.995,
    Female: 6808.64
  },
  {
    Year: 1955,
    Age: '15-19',
    Male: 5721.547,
    Female: 5681.358
  },
  {
    Year: 1955,
    Age: '20-24',
    Male: 5345.967,
    Female: 5568.111
  },
  {
    Year: 1955,
    Age: '25-29',
    Male: 6118.575,
    Female: 6138.299
  },
  {
    Year: 1955,
    Age: '30-34',
    Male: 6414.476,
    Female: 6469.5
  },
  {
    Year: 1955,
    Age: '35-39',
    Male: 6035.021,
    Female: 6076.464
  },
  {
    Year: 1955,
    Age: '40-44',
    Male: 5677.177,
    Female: 5741.519
  },
  {
    Year: 1955,
    Age: '45-49',
    Male: 4981.05,
    Female: 5073.252
  },
  {
    Year: 1955,
    Age: '5-9',
    Male: 8799.042,
    Female: 8405.083
  },
  {
    Year: 1955,
    Age: '50-54',
    Male: 4880.866,
    Female: 4964.295
  },
  {
    Year: 1955,
    Age: '55-59',
    Male: 3937.804,
    Female: 4155.289
  },
  {
    Year: 1955,
    Age: '60-64',
    Male: 3533.731,
    Female: 3742.734
  },
  {
    Year: 1955,
    Age: '65-69',
    Male: 2838.213,
    Female: 3126.665
  },
  {
    Year: 1955,
    Age: '70-74',
    Male: 1936.821,
    Female: 2335.803
  },
  {
    Year: 1955,
    Age: '75-79',
    Male: 1195.512,
    Female: 1451.772
  },
  {
    Year: 1955,
    Age: '80+',
    Male: 928.505,
    Female: 1272.686
  },
  {
    Year: 1956,
    Age: '0-4',
    Male: 9988.801,
    Female: 9569.361
  },
  {
    Year: 1956,
    Age: '10-14',
    Male: 7460.085,
    Female: 7117.69
  },
  {
    Year: 1956,
    Age: '15-19',
    Male: 5932.145,
    Female: 5853.827
  },
  {
    Year: 1956,
    Age: '20-24',
    Male: 5383.614,
    Female: 5540.761
  },
  {
    Year: 1956,
    Age: '25-29',
    Male: 5997,
    Female: 6039.305
  },
  {
    Year: 1956,
    Age: '30-34',
    Male: 6423.233,
    Female: 6471.67
  },
  {
    Year: 1956,
    Age: '35-39',
    Male: 6110.932,
    Female: 6160.837
  },
  {
    Year: 1956,
    Age: '40-44',
    Male: 5759.238,
    Female: 5829.414
  },
  {
    Year: 1956,
    Age: '45-49',
    Male: 5086.93,
    Female: 5208.372
  },
  {
    Year: 1956,
    Age: '5-9',
    Male: 9098.206,
    Female: 8703.547
  },
  {
    Year: 1956,
    Age: '50-54',
    Male: 4904.441,
    Female: 5021.785
  },
  {
    Year: 1956,
    Age: '55-59',
    Male: 4035.843,
    Female: 4280.346
  },
  {
    Year: 1956,
    Age: '60-64',
    Male: 3521.177,
    Female: 3773.248
  },
  {
    Year: 1956,
    Age: '65-69',
    Male: 2868.193,
    Female: 3168.929
  },
  {
    Year: 1956,
    Age: '70-74',
    Male: 2001.298,
    Female: 2413.936
  },
  {
    Year: 1956,
    Age: '75-79',
    Male: 1227.275,
    Female: 1521.306
  },
  {
    Year: 1956,
    Age: '80+',
    Male: 985.38,
    Female: 1347.819
  },
  {
    Year: 1957,
    Age: '0-4',
    Male: 10179.87,
    Female: 9754.16
  },
  {
    Year: 1957,
    Age: '10-14',
    Male: 7793.305,
    Female: 7447.123
  },
  {
    Year: 1957,
    Age: '15-19',
    Male: 6158.73,
    Female: 6050.797
  },
  {
    Year: 1957,
    Age: '20-24',
    Male: 5449.927,
    Female: 5545.261
  },
  {
    Year: 1957,
    Age: '25-29',
    Male: 5872.655,
    Female: 5926.2
  },
  {
    Year: 1957,
    Age: '30-34',
    Male: 6398.744,
    Female: 6436.717
  },
  {
    Year: 1957,
    Age: '35-39',
    Male: 6199.534,
    Female: 6258.219
  },
  {
    Year: 1957,
    Age: '40-44',
    Male: 5806.124,
    Female: 5879.224
  },
  {
    Year: 1957,
    Age: '45-49',
    Male: 5226.558,
    Female: 5364.925
  },
  {
    Year: 1957,
    Age: '5-9',
    Male: 9346.909,
    Female: 8949.768
  },
  {
    Year: 1957,
    Age: '50-54',
    Male: 4893.341,
    Female: 5051.879
  },
  {
    Year: 1957,
    Age: '55-59',
    Male: 4176.875,
    Female: 4437.1
  },
  {
    Year: 1957,
    Age: '60-64',
    Male: 3496.781,
    Female: 3800.403
  },
  {
    Year: 1957,
    Age: '65-69',
    Male: 2896.346,
    Female: 3216.722
  },
  {
    Year: 1957,
    Age: '70-74',
    Male: 2057.752,
    Female: 2475.363
  },
  {
    Year: 1957,
    Age: '75-79',
    Male: 1262.647,
    Female: 1604.972
  },
  {
    Year: 1957,
    Age: '80+',
    Male: 1026.279,
    Female: 1409.947
  },
  {
    Year: 1958,
    Age: '0-4',
    Male: 10371.545,
    Female: 9942.725
  },
  {
    Year: 1958,
    Age: '10-14',
    Male: 8148.743,
    Female: 7795.595
  },
  {
    Year: 1958,
    Age: '15-19',
    Male: 6404.993,
    Female: 6267.129
  },
  {
    Year: 1958,
    Age: '20-24',
    Male: 5528.465,
    Female: 5588.721
  },
  {
    Year: 1958,
    Age: '25-29',
    Male: 5777.064,
    Female: 5812.487
  },
  {
    Year: 1958,
    Age: '30-34',
    Male: 6342.873,
    Female: 6373.671
  },
  {
    Year: 1958,
    Age: '35-39',
    Male: 6291.108,
    Female: 6355.512
  },
  {
    Year: 1958,
    Age: '40-44',
    Male: 5839.691,
    Female: 5915.119
  },
  {
    Year: 1958,
    Age: '45-49',
    Male: 5368.21,
    Female: 5511.475
  },
  {
    Year: 1958,
    Age: '5-9',
    Male: 9540.53,
    Female: 9141.517
  },
  {
    Year: 1958,
    Age: '50-54',
    Male: 4888.278,
    Female: 5089.735
  },
  {
    Year: 1958,
    Age: '55-59',
    Male: 4329.056,
    Female: 4599.277
  },
  {
    Year: 1958,
    Age: '60-64',
    Male: 3481.661,
    Female: 3839.175
  },
  {
    Year: 1958,
    Age: '65-69',
    Male: 2927.559,
    Female: 3274.435
  },
  {
    Year: 1958,
    Age: '70-74',
    Male: 2099.767,
    Female: 2520.839
  },
  {
    Year: 1958,
    Age: '75-79',
    Male: 1305.916,
    Female: 1698.059
  },
  {
    Year: 1958,
    Age: '80+',
    Male: 1050.27,
    Female: 1463.263
  },
  {
    Year: 1959,
    Age: '0-4',
    Male: 10516.487,
    Female: 10086.53
  },
  {
    Year: 1959,
    Age: '10-14',
    Male: 8507.543,
    Female: 8140.984
  },
  {
    Year: 1959,
    Age: '15-19',
    Male: 6673.953,
    Female: 6505.601
  },
  {
    Year: 1959,
    Age: '20-24',
    Male: 5617.494,
    Female: 5671.76
  },
  {
    Year: 1959,
    Age: '25-29',
    Male: 5729.178,
    Female: 5717.377
  },
  {
    Year: 1959,
    Age: '30-34',
    Male: 6267.32,
    Female: 6294.288
  },
  {
    Year: 1959,
    Age: '35-39',
    Male: 6366.011,
    Female: 6430.611
  },
  {
    Year: 1959,
    Age: '40-44',
    Male: 5884.859,
    Female: 5962.414
  },
  {
    Year: 1959,
    Age: '45-49',
    Male: 5483.676,
    Female: 5623.665
  },
  {
    Year: 1959,
    Age: '5-9',
    Male: 9696.879,
    Female: 9296.975
  },
  {
    Year: 1959,
    Age: '50-54',
    Male: 4927.335,
    Female: 5164.47
  },
  {
    Year: 1959,
    Age: '55-59',
    Male: 4456.53,
    Female: 4739.683
  },
  {
    Year: 1959,
    Age: '60-64',
    Male: 3503.014,
    Female: 3908.143
  },
  {
    Year: 1959,
    Age: '65-69',
    Male: 2959.03,
    Female: 3339.268
  },
  {
    Year: 1959,
    Age: '70-74',
    Male: 2129.067,
    Female: 2559.89
  },
  {
    Year: 1959,
    Age: '75-79',
    Male: 1354.65,
    Female: 1789.037
  },
  {
    Year: 1959,
    Age: '80+',
    Male: 1059.486,
    Female: 1514.661
  },
  {
    Year: 1960,
    Age: '0-4',
    Male: 10586.704,
    Female: 10155.039
  },
  {
    Year: 1960,
    Age: '10-14',
    Male: 8838.333,
    Female: 8453.172
  },
  {
    Year: 1960,
    Age: '15-19',
    Male: 6969.582,
    Female: 6773.085
  },
  {
    Year: 1960,
    Age: '20-24',
    Male: 5727.736,
    Female: 5788.329
  },
  {
    Year: 1960,
    Age: '25-29',
    Male: 5720.842,
    Female: 5654.881
  },
  {
    Year: 1960,
    Age: '30-34',
    Male: 6189.705,
    Female: 6205.524
  },
  {
    Year: 1960,
    Age: '35-39',
    Male: 6409.662,
    Female: 6469.7
  },
  {
    Year: 1960,
    Age: '40-44',
    Male: 5951.954,
    Female: 6030.261
  },
  {
    Year: 1960,
    Age: '45-49',
    Male: 5567.363,
    Female: 5700.408
  },
  {
    Year: 1960,
    Age: '5-9',
    Male: 9846.507,
    Female: 9446.485
  },
  {
    Year: 1960,
    Age: '50-54',
    Male: 5014.53,
    Female: 5273.713
  },
  {
    Year: 1960,
    Age: '55-59',
    Male: 4550.023,
    Female: 4853.398
  },
  {
    Year: 1960,
    Age: '60-64',
    Male: 3571.181,
    Female: 4012.676
  },
  {
    Year: 1960,
    Age: '65-69',
    Male: 2986.832,
    Female: 3407.013
  },
  {
    Year: 1960,
    Age: '70-74',
    Male: 2154.791,
    Female: 2604.589
  },
  {
    Year: 1960,
    Age: '75-79',
    Male: 1400.866,
    Female: 1867.538
  },
  {
    Year: 1960,
    Age: '80+',
    Male: 1057.047,
    Female: 1568.76
  },
  {
    Year: 1961,
    Age: '0-4',
    Male: 10691.526,
    Female: 10244.323
  },
  {
    Year: 1961,
    Age: '10-14',
    Male: 9112.193,
    Female: 8726.421
  },
  {
    Year: 1961,
    Age: '15-19',
    Male: 7320.501,
    Female: 7121.632
  },
  {
    Year: 1961,
    Age: '20-24',
    Male: 5913.667,
    Female: 5934.631
  },
  {
    Year: 1961,
    Age: '25-29',
    Male: 5687.883,
    Female: 5618.718
  },
  {
    Year: 1961,
    Age: '30-34',
    Male: 6098.766,
    Female: 6092.63
  },
  {
    Year: 1961,
    Age: '35-39',
    Male: 6409.6,
    Female: 6469.855
  },
  {
    Year: 1961,
    Age: '40-44',
    Male: 6025.961,
    Female: 6111.742
  },
  {
    Year: 1961,
    Age: '45-49',
    Male: 5610.763,
    Female: 5736.483
  },
  {
    Year: 1961,
    Age: '5-9',
    Male: 10022.002,
    Female: 9614.091
  },
  {
    Year: 1961,
    Age: '50-54',
    Male: 5069.295,
    Female: 5340.26
  },
  {
    Year: 1961,
    Age: '55-59',
    Male: 4581.388,
    Female: 4910.069
  },
  {
    Year: 1961,
    Age: '60-64',
    Male: 3639.959,
    Female: 4102.479
  },
  {
    Year: 1961,
    Age: '65-69',
    Male: 2985.377,
    Female: 3458.567
  },
  {
    Year: 1961,
    Age: '70-74',
    Male: 2202.213,
    Female: 2670.336
  },
  {
    Year: 1961,
    Age: '75-79',
    Male: 1425.373,
    Female: 1907.607
  },
  {
    Year: 1961,
    Age: '80+',
    Male: 1123.159,
    Female: 1675.428
  },
  {
    Year: 1962,
    Age: '0-4',
    Male: 10654.461,
    Female: 10205.471
  },
  {
    Year: 1962,
    Age: '10-14',
    Male: 9346,
    Female: 8953.554
  },
  {
    Year: 1962,
    Age: '15-19',
    Male: 7704.8,
    Female: 7501.324
  },
  {
    Year: 1962,
    Age: '20-24',
    Male: 6137.762,
    Female: 6126.97
  },
  {
    Year: 1962,
    Age: '25-29',
    Male: 5689.177,
    Female: 5621.582
  },
  {
    Year: 1962,
    Age: '30-34',
    Male: 6013.647,
    Female: 5971.999
  },
  {
    Year: 1962,
    Age: '35-39',
    Male: 6381.687,
    Female: 6438.383
  },
  {
    Year: 1962,
    Age: '40-44',
    Male: 6123.15,
    Female: 6214.33
  },
  {
    Year: 1962,
    Age: '45-49',
    Male: 5649.31,
    Female: 5771.002
  },
  {
    Year: 1962,
    Age: '5-9',
    Male: 10211.465,
    Female: 9788.563
  },
  {
    Year: 1962,
    Age: '50-54',
    Male: 5143.493,
    Female: 5408.008
  },
  {
    Year: 1962,
    Age: '55-59',
    Male: 4603.731,
    Female: 4965.054
  },
  {
    Year: 1962,
    Age: '60-64',
    Male: 3739.181,
    Female: 4210.968
  },
  {
    Year: 1962,
    Age: '65-69',
    Male: 2973.199,
    Female: 3501.206
  },
  {
    Year: 1962,
    Age: '70-74',
    Male: 2253.471,
    Female: 2752.693
  },
  {
    Year: 1962,
    Age: '75-79',
    Male: 1449.446,
    Female: 1943.381
  },
  {
    Year: 1962,
    Age: '80+',
    Male: 1174.163,
    Female: 1775.114
  },
  {
    Year: 1963,
    Age: '0-4',
    Male: 10505.279,
    Female: 10065.592
  },
  {
    Year: 1963,
    Age: '10-14',
    Male: 9548.233,
    Female: 9144.953
  },
  {
    Year: 1963,
    Age: '15-19',
    Male: 8102.607,
    Female: 7880.67
  },
  {
    Year: 1963,
    Age: '20-24',
    Male: 6385.656,
    Female: 6368.252
  },
  {
    Year: 1963,
    Age: '25-29',
    Male: 5731.938,
    Female: 5662.181
  },
  {
    Year: 1963,
    Age: '30-34',
    Male: 5939.41,
    Female: 5855.499
  },
  {
    Year: 1963,
    Age: '35-39',
    Male: 6328.831,
    Female: 6377.949
  },
  {
    Year: 1963,
    Age: '40-44',
    Male: 6225.045,
    Female: 6318.333
  },
  {
    Year: 1963,
    Age: '45-49',
    Male: 5691.224,
    Female: 5815.425
  },
  {
    Year: 1963,
    Age: '5-9',
    Male: 10403.106,
    Female: 9963.312
  },
  {
    Year: 1963,
    Age: '50-54',
    Male: 5220.263,
    Female: 5462.664
  },
  {
    Year: 1963,
    Age: '55-59',
    Male: 4635.127,
    Female: 5031.241
  },
  {
    Year: 1963,
    Age: '60-64',
    Male: 3845.374,
    Female: 4322.593
  },
  {
    Year: 1963,
    Age: '65-69',
    Male: 2968.371,
    Female: 3544.423
  },
  {
    Year: 1963,
    Age: '70-74',
    Male: 2297.022,
    Female: 2841.693
  },
  {
    Year: 1963,
    Age: '75-79',
    Male: 1481.009,
    Female: 1986.18
  },
  {
    Year: 1963,
    Age: '80+',
    Male: 1204.627,
    Female: 1862.122
  },
  {
    Year: 1964,
    Age: '0-4',
    Male: 10301.728,
    Female: 9877.38
  },
  {
    Year: 1964,
    Age: '10-14',
    Male: 9739.821,
    Female: 9322.079
  },
  {
    Year: 1964,
    Age: '15-19',
    Male: 8476.754,
    Female: 8225.005
  },
  {
    Year: 1964,
    Age: '20-24',
    Male: 6651.193,
    Female: 6652.975
  },
  {
    Year: 1964,
    Age: '25-29',
    Male: 5818.075,
    Female: 5739.903
  },
  {
    Year: 1964,
    Age: '30-34',
    Male: 5880.872,
    Female: 5758.235
  },
  {
    Year: 1964,
    Age: '35-39',
    Male: 6259.557,
    Female: 6294.98
  },
  {
    Year: 1964,
    Age: '40-44',
    Male: 6303.508,
    Female: 6396.315
  },
  {
    Year: 1964,
    Age: '45-49',
    Male: 5745.44,
    Female: 5877.06
  },
  {
    Year: 1964,
    Age: '5-9',
    Male: 10565.734,
    Female: 10113.62
  },
  {
    Year: 1964,
    Age: '50-54',
    Male: 5286.024,
    Female: 5500.947
  },
  {
    Year: 1964,
    Age: '55-59',
    Male: 4687.396,
    Female: 5110.544
  },
  {
    Year: 1964,
    Age: '60-64',
    Male: 3935.254,
    Female: 4423.018
  },
  {
    Year: 1964,
    Age: '65-69',
    Male: 2988.22,
    Female: 3600.455
  },
  {
    Year: 1964,
    Age: '70-74',
    Male: 2324.505,
    Female: 2925.331
  },
  {
    Year: 1964,
    Age: '75-79',
    Male: 1520.731,
    Female: 2044.334
  },
  {
    Year: 1964,
    Age: '80+',
    Male: 1212.773,
    Female: 1932.082
  },
  {
    Year: 1965,
    Age: '0-4',
    Male: 10091.796,
    Female: 9681.39
  },
  {
    Year: 1965,
    Age: '10-14',
    Male: 9937.79,
    Female: 9502.868
  },
  {
    Year: 1965,
    Age: '15-19',
    Male: 8802.521,
    Female: 8519.531
  },
  {
    Year: 1965,
    Age: '20-24',
    Male: 6937.745,
    Female: 6967.53
  },
  {
    Year: 1965,
    Age: '25-29',
    Male: 5940.771,
    Female: 5858.456
  },
  {
    Year: 1965,
    Age: '30-34',
    Male: 5843.395,
    Female: 5690.956
  },
  {
    Year: 1965,
    Age: '35-39',
    Male: 6183.487,
    Female: 6196.841
  },
  {
    Year: 1965,
    Age: '40-44',
    Male: 6341.696,
    Female: 6432.982
  },
  {
    Year: 1965,
    Age: '45-49',
    Male: 5814.562,
    Female: 5954.615
  },
  {
    Year: 1965,
    Age: '5-9',
    Male: 10658.529,
    Female: 10204.993
  },
  {
    Year: 1965,
    Age: '50-54',
    Male: 5339.59,
    Female: 5532.502
  },
  {
    Year: 1965,
    Age: '55-59',
    Male: 4756.92,
    Female: 5191.579
  },
  {
    Year: 1965,
    Age: '60-64',
    Male: 4005.514,
    Female: 4512.619
  },
  {
    Year: 1965,
    Age: '65-69',
    Male: 3035.833,
    Female: 3673.725
  },
  {
    Year: 1965,
    Age: '70-74',
    Male: 2338.368,
    Female: 2998.596
  },
  {
    Year: 1965,
    Age: '75-79',
    Male: 1562.247,
    Female: 2118.165
  },
  {
    Year: 1965,
    Age: '80+',
    Male: 1201.176,
    Female: 1986.261
  },
  {
    Year: 1966,
    Age: '0-4',
    Male: 9850.98,
    Female: 9436.247
  },
  {
    Year: 1966,
    Age: '10-14',
    Male: 10143.891,
    Female: 9699.2
  },
  {
    Year: 1966,
    Age: '15-19',
    Male: 9000.595,
    Female: 8791.866
  },
  {
    Year: 1966,
    Age: '20-24',
    Male: 7291.94,
    Female: 7277.592
  },
  {
    Year: 1966,
    Age: '25-29',
    Male: 6100.807,
    Female: 6026.595
  },
  {
    Year: 1966,
    Age: '30-34',
    Male: 5807.965,
    Female: 5662.386
  },
  {
    Year: 1966,
    Age: '35-39',
    Male: 6110.737,
    Female: 6095.467
  },
  {
    Year: 1966,
    Age: '40-44',
    Male: 6352.691,
    Female: 6436.151
  },
  {
    Year: 1966,
    Age: '45-49',
    Male: 5897.667,
    Female: 6040.02
  },
  {
    Year: 1966,
    Age: '5-9',
    Male: 10706.579,
    Female: 10245.683
  },
  {
    Year: 1966,
    Age: '50-54',
    Male: 5378.205,
    Female: 5579.694
  },
  {
    Year: 1966,
    Age: '55-59',
    Male: 4781.225,
    Female: 5216.198
  },
  {
    Year: 1966,
    Age: '60-64',
    Male: 4069.579,
    Female: 4612.795
  },
  {
    Year: 1966,
    Age: '65-69',
    Male: 3083.196,
    Female: 3750.021
  },
  {
    Year: 1966,
    Age: '70-74',
    Male: 2340.414,
    Female: 3034.525
  },
  {
    Year: 1966,
    Age: '75-79',
    Male: 1590.485,
    Female: 2177.488
  },
  {
    Year: 1966,
    Age: '80+',
    Male: 1279.61,
    Female: 2106.738
  },
  {
    Year: 1967,
    Age: '0-4',
    Male: 9610.609,
    Female: 9202.684
  },
  {
    Year: 1967,
    Age: '10-14',
    Male: 10347.408,
    Female: 9886.028
  },
  {
    Year: 1967,
    Age: '15-19',
    Male: 9177.974,
    Female: 9018.082
  },
  {
    Year: 1967,
    Age: '20-24',
    Male: 7616.821,
    Female: 7613.203
  },
  {
    Year: 1967,
    Age: '25-29',
    Male: 6307.672,
    Female: 6224.603
  },
  {
    Year: 1967,
    Age: '30-34',
    Male: 5803.156,
    Female: 5669.621
  },
  {
    Year: 1967,
    Age: '35-39',
    Male: 6022.886,
    Female: 5981.26
  },
  {
    Year: 1967,
    Age: '40-44',
    Male: 6330.799,
    Female: 6405.516
  },
  {
    Year: 1967,
    Age: '45-49',
    Male: 5996.665,
    Female: 6137.058
  },
  {
    Year: 1967,
    Age: '5-9',
    Male: 10691.992,
    Female: 10223.061
  },
  {
    Year: 1967,
    Age: '50-54',
    Male: 5417.158,
    Female: 5630.618
  },
  {
    Year: 1967,
    Age: '55-59',
    Male: 4812.009,
    Female: 5236.206
  },
  {
    Year: 1967,
    Age: '60-64',
    Male: 4113.739,
    Female: 4695.954
  },
  {
    Year: 1967,
    Age: '65-69',
    Male: 3158.156,
    Female: 3852.663
  },
  {
    Year: 1967,
    Age: '70-74',
    Male: 2329.759,
    Female: 3062.946
  },
  {
    Year: 1967,
    Age: '75-79',
    Male: 1612.073,
    Female: 2240.325
  },
  {
    Year: 1967,
    Age: '80+',
    Male: 1341.049,
    Female: 2212.172
  },
  {
    Year: 1968,
    Age: '0-4',
    Male: 9389.039,
    Female: 8990.639
  },
  {
    Year: 1968,
    Age: '10-14',
    Male: 10524.654,
    Female: 10054.237
  },
  {
    Year: 1968,
    Age: '15-19',
    Male: 9382.352,
    Female: 9208.044
  },
  {
    Year: 1968,
    Age: '20-24',
    Male: 7874.949,
    Female: 7962.419
  },
  {
    Year: 1968,
    Age: '25-29',
    Male: 6559.546,
    Female: 6446.878
  },
  {
    Year: 1968,
    Age: '30-34',
    Male: 5841.235,
    Female: 5716.931
  },
  {
    Year: 1968,
    Age: '35-39',
    Male: 5925.994,
    Female: 5866.74
  },
  {
    Year: 1968,
    Age: '40-44',
    Male: 6284.197,
    Female: 6346.679
  },
  {
    Year: 1968,
    Age: '45-49',
    Male: 6097.055,
    Female: 6233.776
  },
  {
    Year: 1968,
    Age: '5-9',
    Male: 10619.152,
    Female: 10140.485
  },
  {
    Year: 1968,
    Age: '50-54',
    Male: 5460.917,
    Female: 5682.45
  },
  {
    Year: 1968,
    Age: '55-59',
    Male: 4855.654,
    Female: 5266.056
  },
  {
    Year: 1968,
    Age: '60-64',
    Male: 4138.577,
    Female: 4754.684
  },
  {
    Year: 1968,
    Age: '65-69',
    Male: 3253.98,
    Female: 3975.406
  },
  {
    Year: 1968,
    Age: '70-74',
    Male: 2316.08,
    Female: 3094.434
  },
  {
    Year: 1968,
    Age: '75-79',
    Male: 1629.579,
    Female: 2303.247
  },
  {
    Year: 1968,
    Age: '80+',
    Male: 1380.831,
    Female: 2303.521
  },
  {
    Year: 1969,
    Age: '0-4',
    Male: 9190.941,
    Female: 8798.425
  },
  {
    Year: 1969,
    Age: '10-14',
    Male: 10660.541,
    Female: 10184.385
  },
  {
    Year: 1969,
    Age: '15-19',
    Male: 9629.624,
    Female: 9385.815
  },
  {
    Year: 1969,
    Age: '20-24',
    Male: 8069.996,
    Female: 8300.183
  },
  {
    Year: 1969,
    Age: '25-29',
    Male: 6836.86,
    Female: 6693.872
  },
  {
    Year: 1969,
    Age: '30-34',
    Male: 5930.529,
    Female: 5803.802
  },
  {
    Year: 1969,
    Age: '35-39',
    Male: 5838.06,
    Female: 5771.328
  },
  {
    Year: 1969,
    Age: '40-44',
    Male: 6223.672,
    Female: 6269.302
  },
  {
    Year: 1969,
    Age: '45-49',
    Male: 6178.525,
    Female: 6309.489
  },
  {
    Year: 1969,
    Age: '5-9',
    Male: 10505.966,
    Female: 10016.014
  },
  {
    Year: 1969,
    Age: '50-54',
    Male: 5520.141,
    Female: 5740.414
  },
  {
    Year: 1969,
    Age: '55-59',
    Male: 4912.025,
    Female: 5311.998
  },
  {
    Year: 1969,
    Age: '60-64',
    Male: 4157.553,
    Female: 4794.351
  },
  {
    Year: 1969,
    Age: '65-69',
    Male: 3351.998,
    Female: 4101.526
  },
  {
    Year: 1969,
    Age: '70-74',
    Male: 2317.76,
    Female: 3144.792
  },
  {
    Year: 1969,
    Age: '75-79',
    Male: 1641.663,
    Female: 2362.007
  },
  {
    Year: 1969,
    Age: '80+',
    Male: 1396.732,
    Female: 2382.711
  },
  {
    Year: 1970,
    Age: '0-4',
    Male: 9006.651,
    Female: 8616.525
  },
  {
    Year: 1970,
    Age: '10-14',
    Male: 10751.766,
    Female: 10259.953
  },
  {
    Year: 1970,
    Age: '15-19',
    Male: 9898.236,
    Female: 9566.935
  },
  {
    Year: 1970,
    Age: '20-24',
    Male: 8246.6,
    Female: 8605.287
  },
  {
    Year: 1970,
    Age: '25-29',
    Male: 7105.404,
    Female: 6969.584
  },
  {
    Year: 1970,
    Age: '30-34',
    Male: 6072.645,
    Female: 5925.901
  },
  {
    Year: 1970,
    Age: '35-39',
    Male: 5780.184,
    Female: 5710.019
  },
  {
    Year: 1970,
    Age: '40-44',
    Male: 6154.325,
    Female: 6180.808
  },
  {
    Year: 1970,
    Age: '45-49',
    Male: 6229.816,
    Female: 6350.457
  },
  {
    Year: 1970,
    Age: '5-9',
    Male: 10378.621,
    Female: 9877.661
  },
  {
    Year: 1970,
    Age: '50-54',
    Male: 5601.456,
    Female: 5811.224
  },
  {
    Year: 1970,
    Age: '55-59',
    Male: 4977.132,
    Female: 5369.135
  },
  {
    Year: 1970,
    Age: '60-64',
    Male: 4186.98,
    Female: 4829.33
  },
  {
    Year: 1970,
    Age: '65-69',
    Male: 3435.496,
    Female: 4213.989
  },
  {
    Year: 1970,
    Age: '70-74',
    Male: 2349.017,
    Female: 3223.846
  },
  {
    Year: 1970,
    Age: '75-79',
    Male: 1646.324,
    Female: 2416.241
  },
  {
    Year: 1970,
    Age: '80+',
    Male: 1389.004,
    Female: 2451.59
  },
  {
    Year: 1971,
    Age: '0-4',
    Male: 8733.581,
    Female: 8374.675
  },
  {
    Year: 1971,
    Age: '10-14',
    Male: 10786.853,
    Female: 10304.049
  },
  {
    Year: 1971,
    Age: '15-19',
    Male: 10158.29,
    Female: 9774.899
  },
  {
    Year: 1971,
    Age: '20-24',
    Male: 8652.088,
    Female: 8886.255
  },
  {
    Year: 1971,
    Age: '25-29',
    Male: 7369.101,
    Female: 7318.527
  },
  {
    Year: 1971,
    Age: '30-34',
    Male: 6225.131,
    Female: 6078.325
  },
  {
    Year: 1971,
    Age: '35-39',
    Male: 5772.008,
    Female: 5680.252
  },
  {
    Year: 1971,
    Age: '40-44',
    Male: 6058.441,
    Female: 6073.6
  },
  {
    Year: 1971,
    Age: '45-49',
    Male: 6224.598,
    Female: 6350.323
  },
  {
    Year: 1971,
    Age: '5-9',
    Male: 10190.846,
    Female: 9710.921
  },
  {
    Year: 1971,
    Age: '50-54',
    Male: 5670.227,
    Female: 5893.946
  },
  {
    Year: 1971,
    Age: '55-59',
    Male: 5016.661,
    Female: 5399.449
  },
  {
    Year: 1971,
    Age: '60-64',
    Male: 4234.208,
    Female: 4900.723
  },
  {
    Year: 1971,
    Age: '65-69',
    Male: 3461.91,
    Female: 4258.641
  },
  {
    Year: 1971,
    Age: '70-74',
    Male: 2408.168,
    Female: 3306.605
  },
  {
    Year: 1971,
    Age: '75-79',
    Male: 1655.012,
    Female: 2471.212
  },
  {
    Year: 1971,
    Age: '80+',
    Male: 1470.675,
    Female: 2591.402
  },
  {
    Year: 1972,
    Age: '0-4',
    Male: 8587.996,
    Female: 8236.331
  },
  {
    Year: 1972,
    Age: '10-14',
    Male: 10773.892,
    Female: 10291.924
  },
  {
    Year: 1972,
    Age: '15-19',
    Male: 10367.461,
    Female: 9975.236
  },
  {
    Year: 1972,
    Age: '20-24',
    Male: 9048.168,
    Female: 9117.538
  },
  {
    Year: 1972,
    Age: '25-29',
    Male: 7659.369,
    Female: 7691.962
  },
  {
    Year: 1972,
    Age: '30-34',
    Male: 6422.761,
    Female: 6274.234
  },
  {
    Year: 1972,
    Age: '35-39',
    Male: 5788.343,
    Female: 5683.304
  },
  {
    Year: 1972,
    Age: '40-44',
    Male: 5960.645,
    Female: 5953.675
  },
  {
    Year: 1972,
    Age: '45-49',
    Male: 6192.371,
    Female: 6316.116
  },
  {
    Year: 1972,
    Age: '5-9',
    Male: 9945.371,
    Female: 9492.708
  },
  {
    Year: 1972,
    Age: '50-54',
    Male: 5754.76,
    Female: 5990.595
  },
  {
    Year: 1972,
    Age: '55-59',
    Male: 5051.084,
    Female: 5427.604
  },
  {
    Year: 1972,
    Age: '60-64',
    Male: 4292.895,
    Female: 4962.218
  },
  {
    Year: 1972,
    Age: '65-69',
    Male: 3479.655,
    Female: 4312.897
  },
  {
    Year: 1972,
    Age: '70-74',
    Male: 2479.936,
    Female: 3390.86
  },
  {
    Year: 1972,
    Age: '75-79',
    Male: 1651.097,
    Female: 2519.548
  },
  {
    Year: 1972,
    Age: '80+',
    Male: 1536.558,
    Female: 2722.655
  },
  {
    Year: 1973,
    Age: '0-4',
    Male: 8525.632,
    Female: 8167.381
  },
  {
    Year: 1973,
    Age: '10-14',
    Male: 10720.417,
    Female: 10234.596
  },
  {
    Year: 1973,
    Age: '15-19',
    Male: 10541.534,
    Female: 10155.291
  },
  {
    Year: 1973,
    Age: '20-24',
    Male: 9399.5,
    Female: 9320.655
  },
  {
    Year: 1973,
    Age: '25-29',
    Male: 7992.595,
    Female: 8066.111
  },
  {
    Year: 1973,
    Age: '30-34',
    Male: 6663.845,
    Female: 6520.833
  },
  {
    Year: 1973,
    Age: '35-39',
    Male: 5828.934,
    Female: 5722.245
  },
  {
    Year: 1973,
    Age: '40-44',
    Male: 5876.335,
    Female: 5837.328
  },
  {
    Year: 1973,
    Age: '45-49',
    Male: 6140.709,
    Female: 6256.639
  },
  {
    Year: 1973,
    Age: '5-9',
    Male: 9653.122,
    Female: 9235.673
  },
  {
    Year: 1973,
    Age: '50-54',
    Male: 5842.75,
    Female: 6085.264
  },
  {
    Year: 1973,
    Age: '55-59',
    Male: 5091.529,
    Female: 5470.646
  },
  {
    Year: 1973,
    Age: '60-64',
    Male: 4354.457,
    Female: 5001.258
  },
  {
    Year: 1973,
    Age: '65-69',
    Male: 3507.055,
    Female: 4394.745
  },
  {
    Year: 1973,
    Age: '70-74',
    Male: 2549.956,
    Female: 3466.386
  },
  {
    Year: 1973,
    Age: '75-79',
    Male: 1647.521,
    Female: 2568.176
  },
  {
    Year: 1973,
    Age: '80+',
    Male: 1582.29,
    Female: 2847.269
  },
  {
    Year: 1974,
    Age: '0-4',
    Male: 8493.622,
    Female: 8124.714
  },
  {
    Year: 1974,
    Age: '10-14',
    Male: 10624.432,
    Female: 10138.366
  },
  {
    Year: 1974,
    Age: '15-19',
    Male: 10683.094,
    Female: 10297.298
  },
  {
    Year: 1974,
    Age: '20-24',
    Male: 9693.08,
    Female: 9523.57
  },
  {
    Year: 1974,
    Age: '25-29',
    Male: 8368.365,
    Female: 8417.269
  },
  {
    Year: 1974,
    Age: '30-34',
    Male: 6941.237,
    Female: 6817.08
  },
  {
    Year: 1974,
    Age: '35-39',
    Male: 5901.968,
    Female: 5803.176
  },
  {
    Year: 1974,
    Age: '40-44',
    Male: 5818.698,
    Female: 5745.048
  },
  {
    Year: 1974,
    Age: '45-49',
    Male: 6080.683,
    Female: 6182.966
  },
  {
    Year: 1974,
    Age: '5-9',
    Male: 9346.044,
    Female: 8968.93
  },
  {
    Year: 1974,
    Age: '50-54',
    Male: 5915.466,
    Female: 6158.589
  },
  {
    Year: 1974,
    Age: '55-59',
    Male: 5149.643,
    Female: 5538.3
  },
  {
    Year: 1974,
    Age: '60-64',
    Male: 4414.087,
    Female: 5025.012
  },
  {
    Year: 1974,
    Age: '65-69',
    Male: 3555.692,
    Female: 4501.152
  },
  {
    Year: 1974,
    Age: '70-74',
    Male: 2606.968,
    Female: 3534.095
  },
  {
    Year: 1974,
    Age: '75-79',
    Male: 1657.657,
    Female: 2625.521
  },
  {
    Year: 1974,
    Age: '80+',
    Male: 1602.759,
    Female: 2963.813
  },
  {
    Year: 1975,
    Age: '0-4',
    Male: 8460.701,
    Female: 8079.214
  },
  {
    Year: 1975,
    Age: '10-14',
    Male: 10474.911,
    Female: 10000.17
  },
  {
    Year: 1975,
    Age: '15-19',
    Male: 10783.567,
    Female: 10390.985
  },
  {
    Year: 1975,
    Age: '20-24',
    Male: 9941.033,
    Female: 9737.355
  },
  {
    Year: 1975,
    Age: '25-29',
    Male: 8759.47,
    Female: 8735.987
  },
  {
    Year: 1975,
    Age: '30-34',
    Male: 7252.102,
    Female: 7151.43
  },
  {
    Year: 1975,
    Age: '35-39',
    Male: 6019.423,
    Female: 5934.056
  },
  {
    Year: 1975,
    Age: '40-44',
    Male: 5789.86,
    Female: 5689.175
  },
  {
    Year: 1975,
    Age: '45-49',
    Male: 6020.415,
    Female: 6102.047
  },
  {
    Year: 1975,
    Age: '5-9',
    Male: 9069.333,
    Female: 8730.894
  },
  {
    Year: 1975,
    Age: '50-54',
    Male: 5961.438,
    Female: 6201.037
  },
  {
    Year: 1975,
    Age: '55-59',
    Male: 5228.204,
    Female: 5627.045
  },
  {
    Year: 1975,
    Age: '60-64',
    Male: 4473.522,
    Female: 5052.69
  },
  {
    Year: 1975,
    Age: '65-69',
    Male: 3622.627,
    Female: 4610.068
  },
  {
    Year: 1975,
    Age: '70-74',
    Male: 2653.734,
    Female: 3609.002
  },
  {
    Year: 1975,
    Age: '75-79',
    Male: 1684.329,
    Female: 2692.496
  },
  {
    Year: 1975,
    Age: '80+',
    Male: 1595.825,
    Female: 3071.154
  },
  {
    Year: 1976,
    Age: '0-4',
    Male: 8553.332,
    Female: 8101.619
  },
  {
    Year: 1976,
    Age: '10-14',
    Male: 10356.203,
    Female: 9822.001
  },
  {
    Year: 1976,
    Age: '15-19',
    Male: 10863.475,
    Female: 10447.008
  },
  {
    Year: 1976,
    Age: '20-24',
    Male: 10160.4,
    Female: 9940.013
  },
  {
    Year: 1976,
    Age: '25-29',
    Male: 9043.46,
    Female: 9032.65
  },
  {
    Year: 1976,
    Age: '30-34',
    Male: 7463.519,
    Female: 7469.55
  },
  {
    Year: 1976,
    Age: '35-39',
    Male: 6159.052,
    Female: 6111.735
  },
  {
    Year: 1976,
    Age: '40-44',
    Male: 5701.827,
    Female: 5664.827
  },
  {
    Year: 1976,
    Age: '45-49',
    Male: 5894.878,
    Female: 6012.628
  },
  {
    Year: 1976,
    Age: '5-9',
    Male: 8946.103,
    Female: 8539.795
  },
  {
    Year: 1976,
    Age: '50-54',
    Male: 5938.63,
    Female: 6220.724
  },
  {
    Year: 1976,
    Age: '55-59',
    Male: 5297.383,
    Female: 5720.545
  },
  {
    Year: 1976,
    Age: '60-64',
    Male: 4556.955,
    Female: 5116.24
  },
  {
    Year: 1976,
    Age: '65-69',
    Male: 3667.083,
    Female: 4642.574
  },
  {
    Year: 1976,
    Age: '70-74',
    Male: 2753.205,
    Female: 3727.16
  },
  {
    Year: 1976,
    Age: '75-79',
    Male: 1712.449,
    Female: 2720.75
  },
  {
    Year: 1976,
    Age: '80+',
    Male: 1661.277,
    Female: 3220.165
  },
  {
    Year: 1977,
    Age: '0-4',
    Male: 8572.724,
    Female: 8081.583
  },
  {
    Year: 1977,
    Age: '10-14',
    Male: 10207.916,
    Female: 9609.89
  },
  {
    Year: 1977,
    Age: '15-19',
    Male: 10934.156,
    Female: 10465.745
  },
  {
    Year: 1977,
    Age: '20-24',
    Male: 10380.622,
    Female: 10150.661
  },
  {
    Year: 1977,
    Age: '25-29',
    Male: 9312.573,
    Female: 9293.887
  },
  {
    Year: 1977,
    Age: '30-34',
    Male: 7731.036,
    Female: 7831.115
  },
  {
    Year: 1977,
    Age: '35-39',
    Male: 6312.2,
    Female: 6329.225
  },
  {
    Year: 1977,
    Age: '40-44',
    Male: 5670.026,
    Female: 5682.762
  },
  {
    Year: 1977,
    Age: '45-49',
    Male: 5754.746,
    Female: 5915.299
  },
  {
    Year: 1977,
    Age: '5-9',
    Male: 8862.444,
    Female: 8396.629
  },
  {
    Year: 1977,
    Age: '50-54',
    Male: 5891.148,
    Female: 6217.999
  },
  {
    Year: 1977,
    Age: '55-59',
    Male: 5374.484,
    Female: 5831.88
  },
  {
    Year: 1977,
    Age: '60-64',
    Male: 4632.168,
    Female: 5195.01
  },
  {
    Year: 1977,
    Age: '65-69',
    Male: 3736.803,
    Female: 4671.448
  },
  {
    Year: 1977,
    Age: '70-74',
    Male: 2828.259,
    Female: 3852.609
  },
  {
    Year: 1977,
    Age: '75-79',
    Male: 1785.338,
    Female: 2782.51
  },
  {
    Year: 1977,
    Age: '80+',
    Male: 1690.166,
    Female: 3338.987
  },
  {
    Year: 1978,
    Age: '0-4',
    Male: 8547.367,
    Female: 8038.651
  },
  {
    Year: 1978,
    Age: '10-14',
    Male: 10038.67,
    Female: 9375.763
  },
  {
    Year: 1978,
    Age: '15-19',
    Male: 10993.013,
    Female: 10438.215
  },
  {
    Year: 1978,
    Age: '20-24',
    Male: 10592.513,
    Female: 10356.108
  },
  {
    Year: 1978,
    Age: '25-29',
    Male: 9554.772,
    Female: 9519.184
  },
  {
    Year: 1978,
    Age: '30-34',
    Male: 8068.2,
    Female: 8224.991
  },
  {
    Year: 1978,
    Age: '35-39',
    Male: 6454.131,
    Female: 6577.157
  },
  {
    Year: 1978,
    Age: '40-44',
    Male: 5707.875,
    Female: 5745.659
  },
  {
    Year: 1978,
    Age: '45-49',
    Male: 5606.351,
    Female: 5819.976
  },
  {
    Year: 1978,
    Age: '5-9',
    Male: 8811.432,
    Female: 8300.173
  },
  {
    Year: 1978,
    Age: '50-54',
    Male: 5823.151,
    Female: 6191.915
  },
  {
    Year: 1978,
    Age: '55-59',
    Male: 5449.552,
    Female: 5950.534
  },
  {
    Year: 1978,
    Age: '60-64',
    Male: 4690.738,
    Female: 5276.913
  },
  {
    Year: 1978,
    Age: '65-69',
    Male: 3845.12,
    Female: 4717.618
  },
  {
    Year: 1978,
    Age: '70-74',
    Male: 2866.043,
    Female: 3961.452
  },
  {
    Year: 1978,
    Age: '75-79',
    Male: 1907.195,
    Female: 2886.255
  },
  {
    Year: 1978,
    Age: '80+',
    Male: 1683.925,
    Female: 3429.04
  },
  {
    Year: 1979,
    Age: '0-4',
    Male: 8529.685,
    Female: 8014.683
  },
  {
    Year: 1979,
    Age: '10-14',
    Male: 9871.348,
    Female: 9142.397
  },
  {
    Year: 1979,
    Age: '15-19',
    Male: 11024.308,
    Female: 10356.629
  },
  {
    Year: 1979,
    Age: '20-24',
    Male: 10782.257,
    Female: 10526.961
  },
  {
    Year: 1979,
    Age: '25-29',
    Male: 9781.03,
    Female: 9725.947
  },
  {
    Year: 1979,
    Age: '30-34',
    Male: 8445.593,
    Female: 8617.004
  },
  {
    Year: 1979,
    Age: '35-39',
    Male: 6597.593,
    Female: 6852.471
  },
  {
    Year: 1979,
    Age: '40-44',
    Male: 5800.024,
    Female: 5849.915
  },
  {
    Year: 1979,
    Age: '45-49',
    Male: 5472.51,
    Female: 5742.135
  },
  {
    Year: 1979,
    Age: '5-9',
    Male: 8770.448,
    Female: 8231.115
  },
  {
    Year: 1979,
    Age: '50-54',
    Male: 5736.909,
    Female: 6144.119
  },
  {
    Year: 1979,
    Age: '55-59',
    Male: 5503.019,
    Female: 6053.154
  },
  {
    Year: 1979,
    Age: '60-64',
    Male: 4740.902,
    Female: 5359.799
  },
  {
    Year: 1979,
    Age: '65-69',
    Male: 3977.702,
    Female: 4789.378
  },
  {
    Year: 1979,
    Age: '70-74',
    Male: 2885.931,
    Female: 4044.643
  },
  {
    Year: 1979,
    Age: '75-79',
    Male: 2050.105,
    Female: 3020.498
  },
  {
    Year: 1979,
    Age: '80+',
    Male: 1658.576,
    Female: 3501.088
  },
  {
    Year: 1980,
    Age: '0-4',
    Male: 8564.794,
    Female: 8043.867
  },
  {
    Year: 1980,
    Age: '10-14',
    Male: 9725.472,
    Female: 8931.763
  },
  {
    Year: 1980,
    Age: '15-19',
    Male: 11013.696,
    Female: 10221.273
  },
  {
    Year: 1980,
    Age: '20-24',
    Male: 10945.376,
    Female: 10639.777
  },
  {
    Year: 1980,
    Age: '25-29',
    Male: 10008.674,
    Female: 9931.411
  },
  {
    Year: 1980,
    Age: '30-34',
    Male: 8815.543,
    Female: 8973.086
  },
  {
    Year: 1980,
    Age: '35-39',
    Male: 6783.587,
    Female: 7159.855
  },
  {
    Year: 1980,
    Age: '40-44',
    Male: 5911.778,
    Female: 5988.768
  },
  {
    Year: 1980,
    Age: '45-49',
    Male: 5381.283,
    Female: 5694.384
  },
  {
    Year: 1980,
    Age: '5-9',
    Male: 8706.763,
    Female: 8159.62
  },
  {
    Year: 1980,
    Age: '50-54',
    Male: 5632.021,
    Female: 6078.041
  },
  {
    Year: 1980,
    Age: '55-59',
    Male: 5522.137,
    Female: 6121.35
  },
  {
    Year: 1980,
    Age: '60-64',
    Male: 4795.999,
    Female: 5449.836
  },
  {
    Year: 1980,
    Age: '65-69',
    Male: 4105.865,
    Female: 4877.063
  },
  {
    Year: 1980,
    Age: '70-74',
    Male: 2924.051,
    Female: 4114.202
  },
  {
    Year: 1980,
    Age: '75-79',
    Male: 2174.713,
    Female: 3161.219
  },
  {
    Year: 1980,
    Age: '80+',
    Male: 1634.644,
    Female: 3571.148
  },
  {
    Year: 1981,
    Age: '0-4',
    Male: 8675.664,
    Female: 8133.288
  },
  {
    Year: 1981,
    Age: '10-14',
    Male: 9523.234,
    Female: 8774.575
  },
  {
    Year: 1981,
    Age: '15-19',
    Male: 10848.442,
    Female: 10051.564
  },
  {
    Year: 1981,
    Age: '20-24',
    Male: 11078.263,
    Female: 10694.932
  },
  {
    Year: 1981,
    Age: '25-29',
    Male: 10263.777,
    Female: 10158.761
  },
  {
    Year: 1981,
    Age: '30-34',
    Male: 9126.204,
    Female: 9248.033
  },
  {
    Year: 1981,
    Age: '35-39',
    Male: 7132.532,
    Female: 7518.056
  },
  {
    Year: 1981,
    Age: '40-44',
    Male: 6036.915,
    Female: 6151.711
  },
  {
    Year: 1981,
    Age: '45-49',
    Male: 5400.911,
    Female: 5674.916
  },
  {
    Year: 1981,
    Age: '5-9',
    Male: 8641.857,
    Female: 8128.741
  },
  {
    Year: 1981,
    Age: '50-54',
    Male: 5535.748,
    Female: 5981.462
  },
  {
    Year: 1981,
    Age: '55-59',
    Male: 5519.927,
    Female: 6125.195
  },
  {
    Year: 1981,
    Age: '60-64',
    Male: 4852.025,
    Female: 5546.971
  },
  {
    Year: 1981,
    Age: '65-69',
    Male: 4133.147,
    Female: 4905.387
  },
  {
    Year: 1981,
    Age: '70-74',
    Male: 2985.566,
    Female: 4169.874
  },
  {
    Year: 1981,
    Age: '75-79',
    Male: 2192.091,
    Female: 3234.236
  },
  {
    Year: 1981,
    Age: '80+',
    Male: 1754.827,
    Female: 3740.134
  },
  {
    Year: 1982,
    Age: '0-4',
    Male: 8774.956,
    Female: 8249.945
  },
  {
    Year: 1982,
    Age: '10-14',
    Male: 9352.539,
    Female: 8647.918
  },
  {
    Year: 1982,
    Age: '15-19',
    Male: 10634.04,
    Female: 9839.548
  },
  {
    Year: 1982,
    Age: '20-24',
    Male: 11166.943,
    Female: 10695.819
  },
  {
    Year: 1982,
    Age: '25-29',
    Male: 10523.549,
    Female: 10382.003
  },
  {
    Year: 1982,
    Age: '30-34',
    Male: 9397.361,
    Female: 9480.562
  },
  {
    Year: 1982,
    Age: '35-39',
    Male: 7544.989,
    Female: 7901.903
  },
  {
    Year: 1982,
    Age: '40-44',
    Male: 6166.256,
    Female: 6352.488
  },
  {
    Year: 1982,
    Age: '45-49',
    Male: 5477.8,
    Female: 5688.901
  },
  {
    Year: 1982,
    Age: '5-9',
    Male: 8616.681,
    Female: 8112.797
  },
  {
    Year: 1982,
    Age: '50-54',
    Male: 5431.353,
    Female: 5873.964
  },
  {
    Year: 1982,
    Age: '55-59',
    Male: 5501.275,
    Female: 6099.245
  },
  {
    Year: 1982,
    Age: '60-64',
    Male: 4930.443,
    Female: 5654.301
  },
  {
    Year: 1982,
    Age: '65-69',
    Male: 4147.733,
    Female: 4943.405
  },
  {
    Year: 1982,
    Age: '70-74',
    Male: 3077.533,
    Female: 4219.559
  },
  {
    Year: 1982,
    Age: '75-79',
    Male: 2170.927,
    Female: 3301.015
  },
  {
    Year: 1982,
    Age: '80+',
    Male: 1875.157,
    Female: 3899.722
  },
  {
    Year: 1983,
    Age: '0-4',
    Male: 8876.107,
    Female: 8392.72
  },
  {
    Year: 1983,
    Age: '10-14',
    Male: 9204.867,
    Female: 8547.342
  },
  {
    Year: 1983,
    Age: '15-19',
    Male: 10400.524,
    Female: 9606.863
  },
  {
    Year: 1983,
    Age: '20-24',
    Male: 11194.443,
    Female: 10647.365
  },
  {
    Year: 1983,
    Age: '25-29',
    Male: 10767.051,
    Female: 10576.383
  },
  {
    Year: 1983,
    Age: '30-34',
    Male: 9653.209,
    Female: 9696.263
  },
  {
    Year: 1983,
    Age: '35-39',
    Male: 7978.741,
    Female: 8283.264
  },
  {
    Year: 1983,
    Age: '40-44',
    Male: 6322.379,
    Female: 6595.437
  },
  {
    Year: 1983,
    Age: '45-49',
    Male: 5593.751,
    Female: 5736.573
  },
  {
    Year: 1983,
    Age: '5-9',
    Male: 8627.354,
    Female: 8111.862
  },
  {
    Year: 1983,
    Age: '50-54',
    Male: 5336.294,
    Female: 5768.561
  },
  {
    Year: 1983,
    Age: '55-59',
    Male: 5467.634,
    Female: 6052.714
  },
  {
    Year: 1983,
    Age: '60-64',
    Male: 5010.576,
    Female: 5748.699
  },
  {
    Year: 1983,
    Age: '65-69',
    Male: 4170.525,
    Female: 5004.616
  },
  {
    Year: 1983,
    Age: '70-74',
    Male: 3175.316,
    Female: 4258.722
  },
  {
    Year: 1983,
    Age: '75-79',
    Male: 2144.839,
    Female: 3370.836
  },
  {
    Year: 1983,
    Age: '80+',
    Male: 1975.612,
    Female: 4046.561
  },
  {
    Year: 1984,
    Age: '0-4',
    Male: 8984.549,
    Female: 8545.373
  },
  {
    Year: 1984,
    Age: '10-14',
    Male: 9076.801,
    Female: 8464.168
  },
  {
    Year: 1984,
    Age: '15-19',
    Male: 10177.73,
    Female: 9384.659
  },
  {
    Year: 1984,
    Age: '20-24',
    Male: 11150.854,
    Female: 10555.249
  },
  {
    Year: 1984,
    Age: '25-29',
    Male: 10971.077,
    Female: 10720.288
  },
  {
    Year: 1984,
    Age: '30-34',
    Male: 9918.393,
    Female: 9920.756
  },
  {
    Year: 1984,
    Age: '35-39',
    Male: 8385.573,
    Female: 8636.458
  },
  {
    Year: 1984,
    Age: '40-44',
    Male: 6535.034,
    Female: 6880.542
  },
  {
    Year: 1984,
    Age: '45-49',
    Male: 5723.422,
    Female: 5820.832
  },
  {
    Year: 1984,
    Age: '5-9',
    Male: 8661.747,
    Female: 8128.169
  },
  {
    Year: 1984,
    Age: '50-54',
    Male: 5275.562,
    Female: 5684.43
  },
  {
    Year: 1984,
    Age: '55-59',
    Male: 5420.485,
    Female: 5993.472
  },
  {
    Year: 1984,
    Age: '60-64',
    Male: 5071.936,
    Female: 5812.427
  },
  {
    Year: 1984,
    Age: '65-69',
    Male: 4218.935,
    Female: 5092.903
  },
  {
    Year: 1984,
    Age: '70-74',
    Male: 3256.562,
    Female: 4294.899
  },
  {
    Year: 1984,
    Age: '75-79',
    Male: 2146.224,
    Female: 3447.048
  },
  {
    Year: 1984,
    Age: '80+',
    Male: 2037.687,
    Female: 4179.623
  },
  {
    Year: 1985,
    Age: '0-4',
    Male: 9109.021,
    Female: 8697.853
  },
  {
    Year: 1985,
    Age: '10-14',
    Male: 8972.62,
    Female: 8392.904
  },
  {
    Year: 1985,
    Age: '15-19',
    Male: 9976.693,
    Female: 9192.183
  },
  {
    Year: 1985,
    Age: '20-24',
    Male: 11043.152,
    Female: 10423.924
  },
  {
    Year: 1985,
    Age: '25-29',
    Male: 11120.315,
    Female: 10807.731
  },
  {
    Year: 1985,
    Age: '30-34',
    Male: 10195.295,
    Female: 10156.2
  },
  {
    Year: 1985,
    Age: '35-39',
    Male: 8746.787,
    Female: 8955.874
  },
  {
    Year: 1985,
    Age: '40-44',
    Male: 6813.156,
    Female: 7199.183
  },
  {
    Year: 1985,
    Age: '45-49',
    Male: 5854.882,
    Female: 5946.51
  },
  {
    Year: 1985,
    Age: '5-9',
    Male: 8701.833,
    Female: 8163.58
  },
  {
    Year: 1985,
    Age: '50-54',
    Male: 5263.05,
    Female: 5633.862
  },
  {
    Year: 1985,
    Age: '55-59',
    Male: 5361.952,
    Female: 5924.552
  },
  {
    Year: 1985,
    Age: '60-64',
    Male: 5107.13,
    Female: 5843.584
  },
  {
    Year: 1985,
    Age: '65-69',
    Male: 4292.659,
    Female: 5197.582
  },
  {
    Year: 1985,
    Age: '70-74',
    Male: 3319.725,
    Female: 4342.876
  },
  {
    Year: 1985,
    Age: '75-79',
    Male: 2182.572,
    Female: 3524.113
  },
  {
    Year: 1985,
    Age: '80+',
    Male: 2057.44,
    Female: 4303.328
  },
  {
    Year: 1986,
    Age: '0-4',
    Male: 9275.465,
    Female: 8897.804
  },
  {
    Year: 1986,
    Age: '10-14',
    Male: 8910.694,
    Female: 8367.048
  },
  {
    Year: 1986,
    Age: '15-19',
    Male: 9773.572,
    Female: 9033.42
  },
  {
    Year: 1986,
    Age: '20-24',
    Male: 10879.339,
    Female: 10230.221
  },
  {
    Year: 1986,
    Age: '25-29',
    Male: 11201.649,
    Female: 10862.568
  },
  {
    Year: 1986,
    Age: '30-34',
    Male: 10424.083,
    Female: 10347.445
  },
  {
    Year: 1986,
    Age: '35-39',
    Male: 9104.33,
    Female: 9273.39
  },
  {
    Year: 1986,
    Age: '40-44',
    Male: 7127.903,
    Female: 7523.304
  },
  {
    Year: 1986,
    Age: '45-49',
    Male: 5980.64,
    Female: 6112.269
  },
  {
    Year: 1986,
    Age: '5-9',
    Male: 8775.185,
    Female: 8268.682
  },
  {
    Year: 1986,
    Age: '50-54',
    Male: 5276.771,
    Female: 5601.983
  },
  {
    Year: 1986,
    Age: '55-59',
    Male: 5277.126,
    Female: 5832.339
  },
  {
    Year: 1986,
    Age: '60-64',
    Male: 5103.734,
    Female: 5856.68
  },
  {
    Year: 1986,
    Age: '65-69',
    Male: 4333.979,
    Female: 5252.335
  },
  {
    Year: 1986,
    Age: '70-74',
    Male: 3376.587,
    Female: 4393.275
  },
  {
    Year: 1986,
    Age: '75-79',
    Male: 2231.207,
    Female: 3547.208
  },
  {
    Year: 1986,
    Age: '80+',
    Male: 2160.871,
    Female: 4485.822
  },
  {
    Year: 1987,
    Age: '0-4',
    Male: 9433.046,
    Female: 9058.858
  },
  {
    Year: 1987,
    Age: '10-14',
    Male: 8880.687,
    Female: 8368.669
  },
  {
    Year: 1987,
    Age: '15-19',
    Male: 9593.744,
    Female: 8917.742
  },
  {
    Year: 1987,
    Age: '20-24',
    Male: 10678.611,
    Female: 10010.243
  },
  {
    Year: 1987,
    Age: '25-29',
    Male: 11228.288,
    Female: 10860.853
  },
  {
    Year: 1987,
    Age: '30-34',
    Male: 10643.333,
    Female: 10546.374
  },
  {
    Year: 1987,
    Age: '35-39',
    Male: 9411.005,
    Female: 9544.641
  },
  {
    Year: 1987,
    Age: '40-44',
    Male: 7514.945,
    Female: 7892.984
  },
  {
    Year: 1987,
    Age: '45-49',
    Male: 6103.547,
    Female: 6312.061
  },
  {
    Year: 1987,
    Age: '5-9',
    Male: 8867.445,
    Female: 8396.829
  },
  {
    Year: 1987,
    Age: '50-54',
    Male: 5344.076,
    Female: 5611.223
  },
  {
    Year: 1987,
    Age: '55-59',
    Male: 5179.693,
    Female: 5727.025
  },
  {
    Year: 1987,
    Age: '60-64',
    Male: 5090.32,
    Female: 5853.829
  },
  {
    Year: 1987,
    Age: '65-69',
    Male: 4386.954,
    Female: 5324.077
  },
  {
    Year: 1987,
    Age: '70-74',
    Male: 3419.662,
    Female: 4452.597
  },
  {
    Year: 1987,
    Age: '75-79',
    Male: 2298.998,
    Female: 3572.06
  },
  {
    Year: 1987,
    Age: '80+',
    Male: 2231.131,
    Female: 4647.31
  },
  {
    Year: 1988,
    Age: '0-4',
    Male: 9584.549,
    Female: 9189.314
  },
  {
    Year: 1988,
    Age: '10-14',
    Male: 8874.999,
    Female: 8394.925
  },
  {
    Year: 1988,
    Age: '15-19',
    Male: 9443.933,
    Female: 8836.863
  },
  {
    Year: 1988,
    Age: '20-24',
    Male: 10463.341,
    Female: 9791.441
  },
  {
    Year: 1988,
    Age: '25-29',
    Male: 11193.26,
    Female: 10789.854
  },
  {
    Year: 1988,
    Age: '30-34',
    Male: 10851.772,
    Female: 10749.971
  },
  {
    Year: 1988,
    Age: '35-39',
    Male: 9667.696,
    Female: 9767.123
  },
  {
    Year: 1988,
    Age: '40-44',
    Male: 7952.133,
    Female: 8296.676
  },
  {
    Year: 1988,
    Age: '45-49',
    Male: 6240.715,
    Female: 6539.865
  },
  {
    Year: 1988,
    Age: '5-9',
    Male: 8977.348,
    Female: 8540.076
  },
  {
    Year: 1988,
    Age: '50-54',
    Male: 5453.32,
    Female: 5664.96
  },
  {
    Year: 1988,
    Age: '55-59',
    Male: 5086.706,
    Female: 5622.191
  },
  {
    Year: 1988,
    Age: '60-64',
    Male: 5065.586,
    Female: 5827.737
  },
  {
    Year: 1988,
    Age: '65-69',
    Male: 4447.992,
    Female: 5411.013
  },
  {
    Year: 1988,
    Age: '70-74',
    Male: 3453.719,
    Female: 4512.484
  },
  {
    Year: 1988,
    Age: '75-79',
    Male: 2379.884,
    Female: 3609.476
  },
  {
    Year: 1988,
    Age: '80+',
    Male: 2273.028,
    Female: 4785.636
  },
  {
    Year: 1989,
    Age: '0-4',
    Male: 9728.031,
    Female: 9304.111
  },
  {
    Year: 1989,
    Age: '10-14',
    Male: 8889.792,
    Female: 8443.126
  },
  {
    Year: 1989,
    Age: '15-19',
    Male: 9328.156,
    Female: 8779.227
  },
  {
    Year: 1989,
    Age: '20-24',
    Male: 10256.673,
    Female: 9596.856
  },
  {
    Year: 1989,
    Age: '25-29',
    Male: 11103.445,
    Female: 10657.419
  },
  {
    Year: 1989,
    Age: '30-34',
    Male: 11031.38,
    Female: 10927.155
  },
  {
    Year: 1989,
    Age: '35-39',
    Male: 9899.413,
    Female: 9964.281
  },
  {
    Year: 1989,
    Age: '40-44',
    Male: 8391.33,
    Female: 8698.459
  },
  {
    Year: 1989,
    Age: '45-49',
    Male: 6428.43,
    Female: 6799.194
  },
  {
    Year: 1989,
    Age: '5-9',
    Male: 9100.48,
    Female: 8685.035
  },
  {
    Year: 1989,
    Age: '50-54',
    Male: 5581.105,
    Female: 5759.932
  },
  {
    Year: 1989,
    Age: '55-59',
    Male: 5025.178,
    Female: 5536.924
  },
  {
    Year: 1989,
    Age: '60-64',
    Male: 5029.364,
    Female: 5777.342
  },
  {
    Year: 1989,
    Age: '65-69',
    Male: 4506.25,
    Female: 5496.852
  },
  {
    Year: 1989,
    Age: '70-74',
    Male: 3491.534,
    Female: 4574.333
  },
  {
    Year: 1989,
    Age: '75-79',
    Male: 2460.382,
    Female: 3664.595
  },
  {
    Year: 1989,
    Age: '80+',
    Male: 2296.24,
    Female: 4901.165
  },
  {
    Year: 1990,
    Age: '0-4',
    Male: 9861.039,
    Female: 9416.018
  },
  {
    Year: 1990,
    Age: '10-14',
    Male: 8926.417,
    Female: 8510.667
  },
  {
    Year: 1990,
    Age: '100+',
    Male: 5.511,
    Female: 24.107
  },
  {
    Year: 1990,
    Age: '15-19',
    Male: 9245.695,
    Female: 8739.476
  },
  {
    Year: 1990,
    Age: '20-24',
    Male: 10072.169,
    Female: 9434.672
  },
  {
    Year: 1990,
    Age: '25-29',
    Male: 10975.972,
    Female: 10487.175
  },
  {
    Year: 1990,
    Age: '30-34',
    Male: 11160.734,
    Female: 11041.524
  },
  {
    Year: 1990,
    Age: '35-39',
    Male: 10131.902,
    Female: 10164.677
  },
  {
    Year: 1990,
    Age: '40-44',
    Male: 8791.884,
    Female: 9061.777
  },
  {
    Year: 1990,
    Age: '45-49',
    Male: 6693.424,
    Female: 7099.255
  },
  {
    Year: 1990,
    Age: '5-9',
    Male: 9229.466,
    Female: 8815.434
  },
  {
    Year: 1990,
    Age: '50-54',
    Male: 5711.729,
    Female: 5889.32
  },
  {
    Year: 1990,
    Age: '55-59',
    Male: 5013.17,
    Female: 5485.24
  },
  {
    Year: 1990,
    Age: '60-64',
    Male: 4983.595,
    Female: 5707.908
  },
  {
    Year: 1990,
    Age: '65-69',
    Male: 4552.783,
    Female: 5562.655
  },
  {
    Year: 1990,
    Age: '70-74',
    Male: 3544.279,
    Female: 4647.663
  },
  {
    Year: 1990,
    Age: '75-79',
    Male: 2530.863,
    Female: 3732.797
  },
  {
    Year: 1990,
    Age: '80-84',
    Male: 1388.914,
    Female: 2677.647
  },
  {
    Year: 1990,
    Age: '85-89',
    Male: 693.694,
    Female: 1537.596
  },
  {
    Year: 1990,
    Age: '90-94',
    Male: 175.327,
    Female: 588.553
  },
  {
    Year: 1990,
    Age: '95-99',
    Male: 44.617,
    Female: 172.604
  },
  {
    Year: 1991,
    Age: '0-4',
    Male: 10002.208,
    Female: 9553.197
  },
  {
    Year: 1991,
    Age: '10-14',
    Male: 9033.353,
    Female: 8615.303
  },
  {
    Year: 1991,
    Age: '100+',
    Male: 5.756,
    Female: 26.027
  },
  {
    Year: 1991,
    Age: '15-19',
    Male: 9153.2,
    Female: 8700.26
  },
  {
    Year: 1991,
    Age: '20-24',
    Male: 9875.278,
    Female: 9293.339
  },
  {
    Year: 1991,
    Age: '25-29',
    Male: 10890.789,
    Female: 10367.275
  },
  {
    Year: 1991,
    Age: '30-34',
    Male: 11243.773,
    Female: 11069.686
  },
  {
    Year: 1991,
    Age: '35-39',
    Male: 10362.179,
    Female: 10379.716
  },
  {
    Year: 1991,
    Age: '40-44',
    Male: 9077.279,
    Female: 9318.716
  },
  {
    Year: 1991,
    Age: '45-49',
    Male: 7017.726,
    Female: 7449.668
  },
  {
    Year: 1991,
    Age: '5-9',
    Male: 9410.982,
    Female: 8995.36
  },
  {
    Year: 1991,
    Age: '50-54',
    Male: 5820.495,
    Female: 6036.674
  },
  {
    Year: 1991,
    Age: '55-59',
    Male: 5034.331,
    Female: 5461.22
  },
  {
    Year: 1991,
    Age: '60-64',
    Male: 4904.776,
    Female: 5610.015
  },
  {
    Year: 1991,
    Age: '65-69',
    Male: 4550.113,
    Female: 5542.459
  },
  {
    Year: 1991,
    Age: '70-74',
    Male: 3600.531,
    Female: 4716.058
  },
  {
    Year: 1991,
    Age: '75-79',
    Male: 2561.72,
    Female: 3738.682
  },
  {
    Year: 1991,
    Age: '80-84',
    Male: 1446.245,
    Female: 2711.911
  },
  {
    Year: 1991,
    Age: '85-89',
    Male: 718.584,
    Female: 1597.547
  },
  {
    Year: 1991,
    Age: '90-94',
    Male: 210.468,
    Female: 645.7
  },
  {
    Year: 1991,
    Age: '95-99',
    Male: 44.919,
    Female: 181.293
  },
  {
    Year: 1992,
    Age: '0-4',
    Male: 10106.148,
    Female: 9654.559
  },
  {
    Year: 1992,
    Age: '10-14',
    Male: 9173.502,
    Female: 8748.293
  },
  {
    Year: 1992,
    Age: '100+',
    Male: 6.02,
    Female: 28.155
  },
  {
    Year: 1992,
    Age: '15-19',
    Male: 9120.758,
    Female: 8692.672
  },
  {
    Year: 1992,
    Age: '20-24',
    Male: 9684.697,
    Female: 9168.367
  },
  {
    Year: 1992,
    Age: '25-29',
    Male: 10754.3,
    Female: 10216.504
  },
  {
    Year: 1992,
    Age: '30-34',
    Male: 11302.987,
    Female: 11054.008
  },
  {
    Year: 1992,
    Age: '35-39',
    Male: 10606.204,
    Female: 10608.237
  },
  {
    Year: 1992,
    Age: '40-44',
    Male: 9320.828,
    Female: 9526.954
  },
  {
    Year: 1992,
    Age: '45-49',
    Male: 7401.095,
    Female: 7829.365
  },
  {
    Year: 1992,
    Age: '5-9',
    Male: 9586.545,
    Female: 9164.28
  },
  {
    Year: 1992,
    Age: '50-54',
    Male: 5935.187,
    Female: 6220.518
  },
  {
    Year: 1992,
    Age: '55-59',
    Male: 5106.202,
    Female: 5474.265
  },
  {
    Year: 1992,
    Age: '60-64',
    Male: 4820.068,
    Female: 5505.918
  },
  {
    Year: 1992,
    Age: '65-69',
    Male: 4541.311,
    Female: 5507.128
  },
  {
    Year: 1992,
    Age: '70-74',
    Male: 3667.99,
    Female: 4796.432
  },
  {
    Year: 1992,
    Age: '75-79',
    Male: 2587.83,
    Female: 3758.284
  },
  {
    Year: 1992,
    Age: '80-84',
    Male: 1503.607,
    Female: 2731.358
  },
  {
    Year: 1992,
    Age: '85-89',
    Male: 725.729,
    Female: 1647.163
  },
  {
    Year: 1992,
    Age: '90-94',
    Male: 241.492,
    Female: 687.776
  },
  {
    Year: 1992,
    Age: '95-99',
    Male: 47.189,
    Female: 194.344
  },
  {
    Year: 1993,
    Age: '0-4',
    Male: 10174.805,
    Female: 9723.917
  },
  {
    Year: 1993,
    Age: '10-14',
    Male: 9332.202,
    Female: 8903.095
  },
  {
    Year: 1993,
    Age: '100+',
    Male: 6.26,
    Female: 30.283
  },
  {
    Year: 1993,
    Age: '15-19',
    Male: 9156.707,
    Female: 8724.194
  },
  {
    Year: 1993,
    Age: '20-24',
    Male: 9519.021,
    Female: 9068.375
  },
  {
    Year: 1993,
    Age: '25-29',
    Male: 10563.848,
    Female: 10035.631
  },
  {
    Year: 1993,
    Age: '30-34',
    Male: 11348.1,
    Female: 11016.152
  },
  {
    Year: 1993,
    Age: '35-39',
    Male: 10845.886,
    Female: 10824.312
  },
  {
    Year: 1993,
    Age: '40-44',
    Male: 9550.763,
    Female: 9718.843
  },
  {
    Year: 1993,
    Age: '45-49',
    Male: 7805.932,
    Female: 8207.982
  },
  {
    Year: 1993,
    Age: '5-9',
    Male: 9750.71,
    Female: 9315.431
  },
  {
    Year: 1993,
    Age: '50-54',
    Male: 6081.467,
    Female: 6448.95
  },
  {
    Year: 1993,
    Age: '55-59',
    Male: 5213.588,
    Female: 5525.08
  },
  {
    Year: 1993,
    Age: '60-64',
    Male: 4746.01,
    Female: 5405.729
  },
  {
    Year: 1993,
    Age: '65-69',
    Male: 4530.769,
    Female: 5467.934
  },
  {
    Year: 1993,
    Age: '70-74',
    Male: 3734.396,
    Female: 4869.503
  },
  {
    Year: 1993,
    Age: '75-79',
    Male: 2625.57,
    Female: 3805.187
  },
  {
    Year: 1993,
    Age: '80-84',
    Male: 1551.372,
    Female: 2739.055
  },
  {
    Year: 1993,
    Age: '85-89',
    Male: 724.603,
    Female: 1688.242
  },
  {
    Year: 1993,
    Age: '90-94',
    Male: 264.251,
    Female: 721.373
  },
  {
    Year: 1993,
    Age: '95-99',
    Male: 49.563,
    Female: 205.095
  },
  {
    Year: 1994,
    Age: '0-4',
    Male: 10211.467,
    Female: 9761.618
  },
  {
    Year: 1994,
    Age: '10-14',
    Male: 9500.704,
    Female: 9071.356
  },
  {
    Year: 1994,
    Age: '100+',
    Male: 6.42,
    Female: 32.131
  },
  {
    Year: 1994,
    Age: '15-19',
    Male: 9253.982,
    Female: 8798.542
  },
  {
    Year: 1994,
    Age: '20-24',
    Male: 9395.093,
    Female: 8998.298
  },
  {
    Year: 1994,
    Age: '25-29',
    Male: 10342.972,
    Female: 9846.01
  },
  {
    Year: 1994,
    Age: '30-34',
    Male: 11373.178,
    Female: 10969.171
  },
  {
    Year: 1994,
    Age: '35-39',
    Male: 11063.582,
    Female: 11002.495
  },
  {
    Year: 1994,
    Age: '40-44',
    Male: 9799.256,
    Female: 9930.687
  },
  {
    Year: 1994,
    Age: '45-49',
    Male: 8190.139,
    Female: 8557.382
  },
  {
    Year: 1994,
    Age: '5-9',
    Male: 9898.555,
    Female: 9446.74
  },
  {
    Year: 1994,
    Age: '50-54',
    Male: 6289.26,
    Female: 6726.069
  },
  {
    Year: 1994,
    Age: '55-59',
    Male: 5336.882,
    Female: 5615.153
  },
  {
    Year: 1994,
    Age: '60-64',
    Male: 4706.909,
    Female: 5329.163
  },
  {
    Year: 1994,
    Age: '65-69',
    Male: 4518.634,
    Female: 5429.917
  },
  {
    Year: 1994,
    Age: '70-74',
    Male: 3790.667,
    Female: 4923.223
  },
  {
    Year: 1994,
    Age: '75-79',
    Male: 2684.055,
    Female: 3882.419
  },
  {
    Year: 1994,
    Age: '80-84',
    Male: 1585.57,
    Female: 2747.72
  },
  {
    Year: 1994,
    Age: '85-89',
    Male: 726.573,
    Female: 1727.526
  },
  {
    Year: 1994,
    Age: '90-94',
    Male: 272.194,
    Female: 744.341
  },
  {
    Year: 1994,
    Age: '95-99',
    Male: 49.057,
    Female: 206.459
  },
  {
    Year: 1995,
    Age: '0-4',
    Male: 10229.669,
    Female: 9779.086
  },
  {
    Year: 1995,
    Age: '10-14',
    Male: 9674.108,
    Female: 9242.989
  },
  {
    Year: 1995,
    Age: '100+',
    Male: 6.463,
    Female: 33.508
  },
  {
    Year: 1995,
    Age: '15-19',
    Male: 9394.367,
    Female: 8912.559
  },
  {
    Year: 1995,
    Age: '20-24',
    Male: 9325.983,
    Female: 8961.935
  },
  {
    Year: 1995,
    Age: '25-29',
    Male: 10123.744,
    Female: 9672.912
  },
  {
    Year: 1995,
    Age: '30-34',
    Male: 11356.648,
    Female: 10905.872
  },
  {
    Year: 1995,
    Age: '35-39',
    Male: 11255.278,
    Female: 11137.653
  },
  {
    Year: 1995,
    Age: '40-44',
    Male: 10076.836,
    Female: 10173.568
  },
  {
    Year: 1995,
    Age: '45-49',
    Male: 8538.087,
    Female: 8871.47
  },
  {
    Year: 1995,
    Age: '5-9',
    Male: 10023.765,
    Female: 9556.23
  },
  {
    Year: 1995,
    Age: '50-54',
    Male: 6565.992,
    Female: 7044.153
  },
  {
    Year: 1995,
    Age: '55-59',
    Male: 5469.043,
    Female: 5747.709
  },
  {
    Year: 1995,
    Age: '60-64',
    Male: 4716.054,
    Female: 5290.913
  },
  {
    Year: 1995,
    Age: '65-69',
    Male: 4503.095,
    Female: 5390.103
  },
  {
    Year: 1995,
    Age: '70-74',
    Male: 3837.256,
    Female: 4960.368
  },
  {
    Year: 1995,
    Age: '75-79',
    Male: 2759.624,
    Female: 3979.609
  },
  {
    Year: 1995,
    Age: '80-84',
    Male: 1613.878,
    Female: 2773.596
  },
  {
    Year: 1995,
    Age: '85-89',
    Male: 733.375,
    Female: 1760.339
  },
  {
    Year: 1995,
    Age: '90-94',
    Male: 263.341,
    Female: 764.509
  },
  {
    Year: 1995,
    Age: '95-99',
    Male: 41.974,
    Female: 191.19
  },
  {
    Year: 1996,
    Age: '0-4',
    Male: 10270.595,
    Female: 9828.272
  },
  {
    Year: 1996,
    Age: '10-14',
    Male: 9856.318,
    Female: 9407.842
  },
  {
    Year: 1996,
    Age: '100+',
    Male: 6.348,
    Female: 34.249
  },
  {
    Year: 1996,
    Age: '15-19',
    Male: 9510.16,
    Female: 9039.14
  },
  {
    Year: 1996,
    Age: '20-24',
    Male: 9358.015,
    Female: 9007.962
  },
  {
    Year: 1996,
    Age: '25-29',
    Male: 9981.547,
    Female: 9555.309
  },
  {
    Year: 1996,
    Age: '30-34',
    Male: 11213.531,
    Female: 10754.859
  },
  {
    Year: 1996,
    Age: '35-39',
    Male: 11371.931,
    Female: 11208.999
  },
  {
    Year: 1996,
    Age: '40-44',
    Male: 10342.245,
    Female: 10412.726
  },
  {
    Year: 1996,
    Age: '45-49',
    Male: 8896.732,
    Female: 9198.64
  },
  {
    Year: 1996,
    Age: '5-9',
    Male: 10193.959,
    Female: 9717.828
  },
  {
    Year: 1996,
    Age: '50-54',
    Male: 6876.643,
    Female: 7377.611
  },
  {
    Year: 1996,
    Age: '55-59',
    Male: 5605.096,
    Female: 5918.211
  },
  {
    Year: 1996,
    Age: '60-64',
    Male: 4748.274,
    Female: 5278.875
  },
  {
    Year: 1996,
    Age: '65-69',
    Male: 4444.004,
    Female: 5300.339
  },
  {
    Year: 1996,
    Age: '70-74',
    Male: 3857.496,
    Female: 4973.932
  },
  {
    Year: 1996,
    Age: '75-79',
    Male: 2816.748,
    Female: 4041.706
  },
  {
    Year: 1996,
    Age: '80-84',
    Male: 1670.297,
    Female: 2813.077
  },
  {
    Year: 1996,
    Age: '85-89',
    Male: 772.925,
    Female: 1774.383
  },
  {
    Year: 1996,
    Age: '90-94',
    Male: 286.089,
    Female: 821.082
  },
  {
    Year: 1996,
    Age: '95-99',
    Male: 50.278,
    Female: 209.159
  },
  {
    Year: 1997,
    Age: '0-4',
    Male: 10221.453,
    Female: 9784.202
  },
  {
    Year: 1997,
    Age: '10-14',
    Male: 10056.222,
    Female: 9587.577
  },
  {
    Year: 1997,
    Age: '100+',
    Male: 6.119,
    Female: 34.536
  },
  {
    Year: 1997,
    Age: '15-19',
    Male: 9655.925,
    Female: 9191.841
  },
  {
    Year: 1997,
    Age: '20-24',
    Male: 9429.99,
    Female: 9080.313
  },
  {
    Year: 1997,
    Age: '25-29',
    Male: 9887.33,
    Female: 9498.644
  },
  {
    Year: 1997,
    Age: '30-34',
    Male: 11040.648,
    Female: 10582.353
  },
  {
    Year: 1997,
    Age: '35-39',
    Male: 11468.033,
    Female: 11252.807
  },
  {
    Year: 1997,
    Age: '40-44',
    Male: 10608.095,
    Female: 10658.721
  },
  {
    Year: 1997,
    Age: '45-49',
    Male: 9225.793,
    Female: 9494.594
  },
  {
    Year: 1997,
    Age: '5-9',
    Male: 10361.211,
    Female: 9879.7
  },
  {
    Year: 1997,
    Age: '50-54',
    Male: 7266.206,
    Female: 7763.706
  },
  {
    Year: 1997,
    Age: '55-59',
    Male: 5748.107,
    Female: 6127.895
  },
  {
    Year: 1997,
    Age: '60-64',
    Male: 4836.752,
    Female: 5315.215
  },
  {
    Year: 1997,
    Age: '65-69',
    Male: 4383.594,
    Female: 5210.566
  },
  {
    Year: 1997,
    Age: '70-74',
    Male: 3877.325,
    Female: 4982.544
  },
  {
    Year: 1997,
    Age: '75-79',
    Male: 2878.701,
    Female: 4115.884
  },
  {
    Year: 1997,
    Age: '80-84',
    Male: 1725.172,
    Female: 2873.935
  },
  {
    Year: 1997,
    Age: '85-89',
    Male: 804.551,
    Female: 1773.31
  },
  {
    Year: 1997,
    Age: '90-94',
    Male: 294.086,
    Female: 849.781
  },
  {
    Year: 1997,
    Age: '95-99',
    Male: 64.52,
    Female: 238.586
  },
  {
    Year: 1998,
    Age: '0-4',
    Male: 10127.777,
    Female: 9691.889
  },
  {
    Year: 1998,
    Age: '10-14',
    Male: 10257.311,
    Female: 9774.664
  },
  {
    Year: 1998,
    Age: '100+',
    Male: 5.85,
    Female: 34.543
  },
  {
    Year: 1998,
    Age: '15-19',
    Male: 9833.283,
    Female: 9364.666
  },
  {
    Year: 1998,
    Age: '20-24',
    Male: 9522.939,
    Female: 9163.898
  },
  {
    Year: 1998,
    Age: '25-29',
    Male: 9829.544,
    Female: 9491.066
  },
  {
    Year: 1998,
    Age: '30-34',
    Male: 10857.71,
    Female: 10402.533
  },
  {
    Year: 1998,
    Age: '35-39',
    Male: 11528.176,
    Female: 11262.324
  },
  {
    Year: 1998,
    Age: '40-44',
    Male: 10859.456,
    Female: 10891.96
  },
  {
    Year: 1998,
    Age: '45-49',
    Male: 9520.655,
    Female: 9757.074
  },
  {
    Year: 1998,
    Age: '5-9',
    Male: 10511.057,
    Female: 10025.281
  },
  {
    Year: 1998,
    Age: '50-54',
    Male: 7710.523,
    Female: 8184.106
  },
  {
    Year: 1998,
    Age: '55-59',
    Male: 5907.98,
    Female: 6370.889
  },
  {
    Year: 1998,
    Age: '60-64',
    Male: 4965.355,
    Female: 5393.839
  },
  {
    Year: 1998,
    Age: '65-69',
    Male: 4336.78,
    Female: 5134.89
  },
  {
    Year: 1998,
    Age: '70-74',
    Male: 3890.425,
    Female: 4976.804
  },
  {
    Year: 1998,
    Age: '75-79',
    Male: 2943.702,
    Female: 4196.539
  },
  {
    Year: 1998,
    Age: '80-84',
    Male: 1779.402,
    Female: 2951.501
  },
  {
    Year: 1998,
    Age: '85-89',
    Male: 826.696,
    Female: 1767.634
  },
  {
    Year: 1998,
    Age: '90-94',
    Male: 294.212,
    Female: 862.612
  },
  {
    Year: 1998,
    Age: '95-99',
    Male: 74.712,
    Female: 260.341
  },
  {
    Year: 1999,
    Age: '0-4',
    Male: 10048.705,
    Female: 9611.607
  },
  {
    Year: 1999,
    Age: '10-14',
    Male: 10445.104,
    Female: 9956.992
  },
  {
    Year: 1999,
    Age: '100+',
    Male: 5.645,
    Female: 34.531
  },
  {
    Year: 1999,
    Age: '15-19',
    Male: 10030.364,
    Female: 9543.665
  },
  {
    Year: 1999,
    Age: '20-24',
    Male: 9620.769,
    Female: 9250.229
  },
  {
    Year: 1999,
    Age: '25-29',
    Male: 9793.893,
    Female: 9507.314
  },
  {
    Year: 1999,
    Age: '30-34',
    Male: 10687.653,
    Female: 10238.502
  },
  {
    Year: 1999,
    Age: '35-39',
    Male: 11532.476,
    Female: 11226.679
  },
  {
    Year: 1999,
    Age: '40-44',
    Male: 11072.289,
    Female: 11081.403
  },
  {
    Year: 1999,
    Age: '45-49',
    Male: 9791.213,
    Female: 9997.53
  },
  {
    Year: 1999,
    Age: '5-9',
    Male: 10623.402,
    Female: 10133.589
  },
  {
    Year: 1999,
    Age: '50-54',
    Male: 8156.773,
    Female: 8598.185
  },
  {
    Year: 1999,
    Age: '55-59',
    Male: 6110.733,
    Female: 6646.16
  },
  {
    Year: 1999,
    Age: '60-64',
    Male: 5107.982,
    Female: 5506.142
  },
  {
    Year: 1999,
    Age: '65-69',
    Male: 4322.273,
    Female: 5087.511
  },
  {
    Year: 1999,
    Age: '70-74',
    Male: 3890.697,
    Female: 4950.879
  },
  {
    Year: 1999,
    Age: '75-79',
    Male: 3004.819,
    Female: 4271.847
  },
  {
    Year: 1999,
    Age: '80-84',
    Male: 1832.799,
    Female: 3037.906
  },
  {
    Year: 1999,
    Age: '85-89',
    Male: 844.71,
    Female: 1775.815
  },
  {
    Year: 1999,
    Age: '90-94',
    Male: 286.561,
    Female: 861.372
  },
  {
    Year: 1999,
    Age: '95-99',
    Male: 74.18,
    Female: 261.37
  },
  {
    Year: 2000,
    Age: '0-4',
    Male: 10013.446,
    Female: 9575.547
  },
  {
    Year: 2000,
    Age: '10-14',
    Male: 10612.008,
    Female: 10122.85
  },
  {
    Year: 2000,
    Age: '100+',
    Male: 5.579,
    Female: 34.696
  },
  {
    Year: 2000,
    Age: '15-19',
    Male: 10229.732,
    Female: 9718.02
  },
  {
    Year: 2000,
    Age: '20-24',
    Male: 9723.494,
    Female: 9341.368
  },
  {
    Year: 2000,
    Age: '25-29',
    Male: 9771.884,
    Female: 9526.164
  },
  {
    Year: 2000,
    Age: '30-34',
    Male: 10541.151,
    Female: 10107.268
  },
  {
    Year: 2000,
    Age: '35-39',
    Male: 11475.533,
    Female: 11141.974
  },
  {
    Year: 2000,
    Age: '40-44',
    Male: 11231.719,
    Female: 11208.997
  },
  {
    Year: 2000,
    Age: '45-49',
    Male: 10047.779,
    Female: 10226.653
  },
  {
    Year: 2000,
    Age: '5-9',
    Male: 10680.792,
    Female: 10186.389
  },
  {
    Year: 2000,
    Age: '50-54',
    Male: 8560.557,
    Female: 8970.219
  },
  {
    Year: 2000,
    Age: '55-59',
    Male: 6377.333,
    Female: 6956.534
  },
  {
    Year: 2000,
    Age: '60-64',
    Male: 5247.917,
    Female: 5646.242
  },
  {
    Year: 2000,
    Age: '65-69',
    Male: 4349.343,
    Female: 5074.161
  },
  {
    Year: 2000,
    Age: '70-74',
    Male: 3879.1,
    Female: 4908.448
  },
  {
    Year: 2000,
    Age: '75-79',
    Male: 3056.004,
    Female: 4330.935
  },
  {
    Year: 2000,
    Age: '80-84',
    Male: 1886.412,
    Female: 3128.72
  },
  {
    Year: 2000,
    Age: '85-89',
    Male: 860.761,
    Female: 1807.83
  },
  {
    Year: 2000,
    Age: '90-94',
    Male: 273.438,
    Female: 851.353
  },
  {
    Year: 2000,
    Age: '95-99',
    Male: 59.49,
    Female: 234.933
  },
  {
    Year: 2001,
    Age: '0-4',
    Male: 9904.602,
    Female: 9477.724
  },
  {
    Year: 2001,
    Age: '10-14',
    Male: 10777.893,
    Female: 10262.345
  },
  {
    Year: 2001,
    Age: '100+',
    Male: 5.712,
    Female: 35.245
  },
  {
    Year: 2001,
    Age: '15-19',
    Male: 10420.006,
    Female: 9898.307
  },
  {
    Year: 2001,
    Age: '20-24',
    Male: 9828.023,
    Female: 9464.55
  },
  {
    Year: 2001,
    Age: '25-29',
    Male: 9740.475,
    Female: 9527.661
  },
  {
    Year: 2001,
    Age: '30-34',
    Male: 10378.075,
    Female: 9998.866
  },
  {
    Year: 2001,
    Age: '35-39',
    Male: 11368.122,
    Female: 11016.968
  },
  {
    Year: 2001,
    Age: '40-44',
    Male: 11367.251,
    Female: 11307.057
  },
  {
    Year: 2001,
    Age: '45-49',
    Male: 10304.521,
    Female: 10465.398
  },
  {
    Year: 2001,
    Age: '5-9',
    Male: 10696.612,
    Female: 10198.088
  },
  {
    Year: 2001,
    Age: '50-54',
    Male: 8901.627,
    Female: 9289.235
  },
  {
    Year: 2001,
    Age: '55-59',
    Male: 6716.025,
    Female: 7317.644
  },
  {
    Year: 2001,
    Age: '60-64',
    Male: 5380.428,
    Female: 5811.496
  },
  {
    Year: 2001,
    Age: '65-69',
    Male: 4403.088,
    Female: 5076.851
  },
  {
    Year: 2001,
    Age: '70-74',
    Male: 3855.183,
    Female: 4847.57
  },
  {
    Year: 2001,
    Age: '75-79',
    Male: 3075.451,
    Female: 4314.117
  },
  {
    Year: 2001,
    Age: '80-84',
    Male: 1950.078,
    Female: 3183.523
  },
  {
    Year: 2001,
    Age: '85-89',
    Male: 917.427,
    Female: 1859.435
  },
  {
    Year: 2001,
    Age: '90-94',
    Male: 304.32,
    Female: 888.806
  },
  {
    Year: 2001,
    Age: '95-99',
    Male: 64.288,
    Female: 252.295
  },
  {
    Year: 2002,
    Age: '0-4',
    Male: 9952.745,
    Female: 9524.046
  },
  {
    Year: 2002,
    Age: '10-14',
    Male: 10912.927,
    Female: 10375.137
  },
  {
    Year: 2002,
    Age: '100+',
    Male: 5.991,
    Female: 35.964
  },
  {
    Year: 2002,
    Age: '15-19',
    Male: 10596.186,
    Female: 10058.098
  },
  {
    Year: 2002,
    Age: '20-24',
    Male: 9960.694,
    Female: 9600.877
  },
  {
    Year: 2002,
    Age: '25-29',
    Male: 9713.096,
    Female: 9529.813
  },
  {
    Year: 2002,
    Age: '30-34',
    Male: 10222.711,
    Female: 9915.406
  },
  {
    Year: 2002,
    Age: '35-39',
    Male: 11191.735,
    Female: 10835.575
  },
  {
    Year: 2002,
    Age: '40-44',
    Male: 11448.991,
    Female: 11346.467
  },
  {
    Year: 2002,
    Age: '45-49',
    Male: 10542.149,
    Female: 10689.228
  },
  {
    Year: 2002,
    Age: '5-9',
    Male: 10618.559,
    Female: 10126.755
  },
  {
    Year: 2002,
    Age: '50-54',
    Male: 9178.397,
    Female: 9543.396
  },
  {
    Year: 2002,
    Age: '55-59',
    Male: 7115.1,
    Female: 7714.393
  },
  {
    Year: 2002,
    Age: '60-64',
    Male: 5502.998,
    Female: 5999.675
  },
  {
    Year: 2002,
    Age: '65-69',
    Male: 4494.118,
    Female: 5108.445
  },
  {
    Year: 2002,
    Age: '70-74',
    Male: 3821.465,
    Female: 4781.52
  },
  {
    Year: 2002,
    Age: '75-79',
    Male: 3089.611,
    Female: 4291.701
  },
  {
    Year: 2002,
    Age: '80-84',
    Male: 2001.746,
    Female: 3226.875
  },
  {
    Year: 2002,
    Age: '85-89',
    Male: 962.425,
    Female: 1907.209
  },
  {
    Year: 2002,
    Age: '90-94',
    Male: 322.883,
    Female: 891.791
  },
  {
    Year: 2002,
    Age: '95-99',
    Male: 72.105,
    Female: 277.85
  },
  {
    Year: 2003,
    Age: '0-4',
    Male: 10098.027,
    Female: 9660.218
  },
  {
    Year: 2003,
    Age: '10-14',
    Male: 11014.53,
    Female: 10464.758
  },
  {
    Year: 2003,
    Age: '100+',
    Male: 6.353,
    Female: 36.833
  },
  {
    Year: 2003,
    Age: '15-19',
    Male: 10761.697,
    Female: 10201.264
  },
  {
    Year: 2003,
    Age: '20-24',
    Male: 10128.632,
    Female: 9748.741
  },
  {
    Year: 2003,
    Age: '25-29',
    Male: 9694.455,
    Female: 9544.951
  },
  {
    Year: 2003,
    Age: '30-34',
    Male: 10087.402,
    Female: 9856.563
  },
  {
    Year: 2003,
    Age: '35-39',
    Male: 10977.34,
    Female: 10630.48
  },
  {
    Year: 2003,
    Age: '40-44',
    Male: 11478.539,
    Female: 11334.34
  },
  {
    Year: 2003,
    Age: '45-49',
    Male: 10757.414,
    Female: 10890.602
  },
  {
    Year: 2003,
    Age: '5-9',
    Male: 10460.662,
    Female: 9982.503
  },
  {
    Year: 2003,
    Age: '50-54',
    Male: 9412.052,
    Female: 9754.37
  },
  {
    Year: 2003,
    Age: '55-59',
    Male: 7545.706,
    Female: 8125.701
  },
  {
    Year: 2003,
    Age: '60-64',
    Male: 5640.262,
    Female: 6218.077
  },
  {
    Year: 2003,
    Age: '65-69',
    Male: 4614.189,
    Female: 5173.535
  },
  {
    Year: 2003,
    Age: '70-74',
    Male: 3792.794,
    Female: 4720.103
  },
  {
    Year: 2003,
    Age: '75-79',
    Male: 3105.805,
    Female: 4274.257
  },
  {
    Year: 2003,
    Age: '80-84',
    Male: 2041.991,
    Female: 3258.767
  },
  {
    Year: 2003,
    Age: '85-89',
    Male: 995.588,
    Female: 1950.826
  },
  {
    Year: 2003,
    Age: '90-94',
    Male: 333.414,
    Female: 882.172
  },
  {
    Year: 2003,
    Age: '95-99',
    Male: 77.55,
    Female: 294.154
  },
  {
    Year: 2004,
    Age: '0-4',
    Male: 10252.035,
    Female: 9804.332
  },
  {
    Year: 2004,
    Age: '10-14',
    Male: 11068.93,
    Female: 10519.022
  },
  {
    Year: 2004,
    Age: '100+',
    Male: 6.705,
    Female: 37.799
  },
  {
    Year: 2004,
    Age: '15-19',
    Male: 10925.513,
    Female: 10336.768
  },
  {
    Year: 2004,
    Age: '20-24',
    Male: 10326.25,
    Female: 9905.81
  },
  {
    Year: 2004,
    Age: '25-29',
    Male: 9703.612,
    Female: 9590.049
  },
  {
    Year: 2004,
    Age: '30-34',
    Male: 9979.537,
    Female: 9818.121
  },
  {
    Year: 2004,
    Age: '35-39',
    Male: 10766.419,
    Female: 10444.693
  },
  {
    Year: 2004,
    Age: '40-44',
    Male: 11459.01,
    Female: 11281.102
  },
  {
    Year: 2004,
    Age: '45-49',
    Male: 10944.833,
    Female: 11058.199
  },
  {
    Year: 2004,
    Age: '5-9',
    Male: 10271.03,
    Female: 9808.841
  },
  {
    Year: 2004,
    Age: '50-54',
    Male: 9639.789,
    Female: 9959.887
  },
  {
    Year: 2004,
    Age: '55-59',
    Male: 7963.276,
    Female: 8519.735
  },
  {
    Year: 2004,
    Age: '60-64',
    Male: 5832.314,
    Female: 6480.738
  },
  {
    Year: 2004,
    Age: '65-69',
    Male: 4748.446,
    Female: 5275.859
  },
  {
    Year: 2004,
    Age: '70-74',
    Male: 3792.565,
    Female: 4681.974
  },
  {
    Year: 2004,
    Age: '75-79',
    Male: 3125.001,
    Female: 4265.312
  },
  {
    Year: 2004,
    Age: '80-84',
    Male: 2073.439,
    Female: 3282.917
  },
  {
    Year: 2004,
    Age: '85-89',
    Male: 1024.543,
    Female: 1998.945
  },
  {
    Year: 2004,
    Age: '90-94',
    Male: 333.53,
    Female: 868.588
  },
  {
    Year: 2004,
    Age: '95-99',
    Male: 75.362,
    Female: 288.504
  },
  {
    Year: 2005,
    Age: '0-4',
    Male: 10363.943,
    Female: 9909.507
  },
  {
    Year: 2005,
    Age: '10-14',
    Male: 11054.684,
    Female: 10514.205
  },
  {
    Year: 2005,
    Age: '100+',
    Male: 6.983,
    Female: 38.816
  },
  {
    Year: 2005,
    Age: '15-19',
    Male: 11087.817,
    Female: 10468.527
  },
  {
    Year: 2005,
    Age: '20-24',
    Male: 10540.028,
    Female: 10068.23
  },
  {
    Year: 2005,
    Age: '25-29',
    Male: 9761.004,
    Female: 9672.476
  },
  {
    Year: 2005,
    Age: '30-34',
    Male: 9897.45,
    Female: 9797.229
  },
  {
    Year: 2005,
    Age: '35-39',
    Male: 10583.373,
    Female: 10301.914
  },
  {
    Year: 2005,
    Age: '40-44',
    Male: 11393.989,
    Female: 11194.746
  },
  {
    Year: 2005,
    Age: '45-49',
    Male: 11099.063,
    Female: 11184.521
  },
  {
    Year: 2005,
    Age: '5-9',
    Male: 10115.05,
    Female: 9666.32
  },
  {
    Year: 2005,
    Age: '50-54',
    Male: 9881.851,
    Female: 10180.527
  },
  {
    Year: 2005,
    Age: '55-59',
    Male: 8339.074,
    Female: 8874.968
  },
  {
    Year: 2005,
    Age: '60-64',
    Male: 6101.221,
    Female: 6794.433
  },
  {
    Year: 2005,
    Age: '65-69',
    Male: 4887.93,
    Female: 5416.074
  },
  {
    Year: 2005,
    Age: '70-74',
    Male: 3835.014,
    Female: 4680.591
  },
  {
    Year: 2005,
    Age: '75-79',
    Male: 3144.564,
    Female: 4261.266
  },
  {
    Year: 2005,
    Age: '80-84',
    Male: 2102.245,
    Female: 3306.974
  },
  {
    Year: 2005,
    Age: '85-89',
    Male: 1048.619,
    Female: 2047.122
  },
  {
    Year: 2005,
    Age: '90-94',
    Male: 327.589,
    Female: 866.583
  },
  {
    Year: 2005,
    Age: '95-99',
    Male: 60.482,
    Female: 252.503
  },
  {
    Year: 2006,
    Age: '0-4',
    Male: 10629.949,
    Female: 10160.449
  },
  {
    Year: 2006,
    Age: '10-14',
    Male: 10971.142,
    Female: 10441.52
  },
  {
    Year: 2006,
    Age: '100+',
    Male: 7.158,
    Female: 39.866
  },
  {
    Year: 2006,
    Age: '15-19',
    Male: 11145.107,
    Female: 10549.577
  },
  {
    Year: 2006,
    Age: '20-24',
    Male: 10665.646,
    Female: 10193.32
  },
  {
    Year: 2006,
    Age: '25-29',
    Male: 9883.705,
    Female: 9759.178
  },
  {
    Year: 2006,
    Age: '30-34',
    Male: 9823.471,
    Female: 9774.243
  },
  {
    Year: 2006,
    Age: '35-39',
    Male: 10405.971,
    Female: 10165.064
  },
  {
    Year: 2006,
    Age: '40-44',
    Male: 11271.956,
    Female: 11051.626
  },
  {
    Year: 2006,
    Age: '45-49',
    Male: 11213.191,
    Female: 11267.891
  },
  {
    Year: 2006,
    Age: '5-9',
    Male: 10110.212,
    Female: 9665.516
  },
  {
    Year: 2006,
    Age: '50-54',
    Male: 10104.076,
    Female: 10394.878
  },
  {
    Year: 2006,
    Age: '55-59',
    Male: 8643.099,
    Female: 9164.933
  },
  {
    Year: 2006,
    Age: '60-64',
    Male: 6412.991,
    Female: 7133.225
  },
  {
    Year: 2006,
    Age: '65-69',
    Male: 4993.713,
    Female: 5555.173
  },
  {
    Year: 2006,
    Age: '70-74',
    Male: 3881.144,
    Female: 4672.544
  },
  {
    Year: 2006,
    Age: '75-79',
    Male: 3139.097,
    Female: 4222.103
  },
  {
    Year: 2006,
    Age: '80-84',
    Male: 2149.93,
    Female: 3327.127
  },
  {
    Year: 2006,
    Age: '85-89',
    Male: 1105.704,
    Female: 2096.893
  },
  {
    Year: 2006,
    Age: '90-94',
    Male: 372.222,
    Female: 931.405
  },
  {
    Year: 2006,
    Age: '95-99',
    Male: 67.701,
    Female: 263.638
  },
  {
    Year: 2007,
    Age: '0-4',
    Male: 10746.083,
    Female: 10270.831
  },
  {
    Year: 2007,
    Age: '10-14',
    Male: 10869.238,
    Female: 10348.265
  },
  {
    Year: 2007,
    Age: '100+',
    Male: 7.271,
    Female: 41.026
  },
  {
    Year: 2007,
    Age: '15-19',
    Male: 11220.453,
    Female: 10640.094
  },
  {
    Year: 2007,
    Age: '20-24',
    Male: 10779.036,
    Female: 10314.583
  },
  {
    Year: 2007,
    Age: '25-29',
    Male: 10041.908,
    Female: 9877.395
  },
  {
    Year: 2007,
    Age: '30-34',
    Male: 9789.434,
    Female: 9775.426
  },
  {
    Year: 2007,
    Age: '35-39',
    Male: 10259.546,
    Female: 10078.532
  },
  {
    Year: 2007,
    Age: '40-44',
    Male: 11112.271,
    Female: 10876.828
  },
  {
    Year: 2007,
    Age: '45-49',
    Male: 11302.36,
    Female: 11316.569
  },
  {
    Year: 2007,
    Age: '5-9',
    Male: 10181.177,
    Female: 9735.995
  },
  {
    Year: 2007,
    Age: '50-54',
    Male: 10341.147,
    Female: 10625
  },
  {
    Year: 2007,
    Age: '55-59',
    Male: 8906.742,
    Female: 9416.228
  },
  {
    Year: 2007,
    Age: '60-64',
    Male: 6799.287,
    Female: 7524.827
  },
  {
    Year: 2007,
    Age: '65-69',
    Male: 5106.45,
    Female: 5734.011
  },
  {
    Year: 2007,
    Age: '70-74',
    Male: 3968.557,
    Female: 4702.956
  },
  {
    Year: 2007,
    Age: '75-79',
    Male: 3123.046,
    Female: 4174.744
  },
  {
    Year: 2007,
    Age: '80-84',
    Male: 2200.852,
    Female: 3359.629
  },
  {
    Year: 2007,
    Age: '85-89',
    Male: 1151.319,
    Female: 2135.39
  },
  {
    Year: 2007,
    Age: '90-94',
    Male: 402.702,
    Female: 971.547
  },
  {
    Year: 2007,
    Age: '95-99',
    Male: 81.43,
    Female: 284.992
  },
  {
    Year: 2008,
    Age: '0-4',
    Male: 10746.542,
    Female: 10271.959
  },
  {
    Year: 2008,
    Age: '10-14',
    Male: 10762.663,
    Female: 10252.592
  },
  {
    Year: 2008,
    Age: '100+',
    Male: 7.377,
    Female: 42.24
  },
  {
    Year: 2008,
    Age: '15-19',
    Male: 11299.085,
    Female: 10723.12
  },
  {
    Year: 2008,
    Age: '20-24',
    Male: 10885.526,
    Female: 10426.315
  },
  {
    Year: 2008,
    Age: '25-29',
    Male: 10207.061,
    Female: 10014.268
  },
  {
    Year: 2008,
    Age: '30-34',
    Male: 9800.091,
    Female: 9798.155
  },
  {
    Year: 2008,
    Age: '35-39',
    Male: 10140.087,
    Female: 10032.808
  },
  {
    Year: 2008,
    Age: '40-44',
    Male: 10929.98,
    Female: 10688.147
  },
  {
    Year: 2008,
    Age: '45-49',
    Male: 11352.718,
    Female: 11321.042
  },
  {
    Year: 2008,
    Age: '5-9',
    Male: 10311.988,
    Female: 9860.983
  },
  {
    Year: 2008,
    Age: '50-54',
    Male: 10579.686,
    Female: 10851.861
  },
  {
    Year: 2008,
    Age: '55-59',
    Male: 9142.861,
    Female: 9642.01
  },
  {
    Year: 2008,
    Age: '60-64',
    Male: 7223.294,
    Female: 7938.558
  },
  {
    Year: 2008,
    Age: '65-69',
    Male: 5247.038,
    Female: 5956.146
  },
  {
    Year: 2008,
    Age: '70-74',
    Male: 4085.31,
    Female: 4771.284
  },
  {
    Year: 2008,
    Age: '75-79',
    Male: 3109.871,
    Female: 4127.039
  },
  {
    Year: 2008,
    Age: '80-84',
    Male: 2252.782,
    Female: 3401.705
  },
  {
    Year: 2008,
    Age: '85-89',
    Male: 1185.801,
    Female: 2165.652
  },
  {
    Year: 2008,
    Age: '90-94',
    Male: 424.122,
    Female: 1000.053
  },
  {
    Year: 2008,
    Age: '95-99',
    Male: 92.413,
    Female: 301.833
  },
  {
    Year: 2009,
    Age: '0-4',
    Male: 10693.001,
    Female: 10220.7
  },
  {
    Year: 2009,
    Age: '10-14',
    Male: 10683.576,
    Female: 10185.422
  },
  {
    Year: 2009,
    Age: '100+',
    Male: 7.55,
    Female: 43.43
  },
  {
    Year: 2009,
    Age: '15-19',
    Male: 11354.019,
    Female: 10772.885
  },
  {
    Year: 2009,
    Age: '20-24',
    Male: 10989.118,
    Female: 10526.255
  },
  {
    Year: 2009,
    Age: '25-29',
    Male: 10353.867,
    Female: 10150.821
  },
  {
    Year: 2009,
    Age: '30-34',
    Male: 9852.074,
    Female: 9842.079
  },
  {
    Year: 2009,
    Age: '35-39',
    Male: 10042.025,
    Female: 10007.702
  },
  {
    Year: 2009,
    Age: '40-44',
    Male: 10745.423,
    Female: 10510.92
  },
  {
    Year: 2009,
    Age: '45-49',
    Male: 11350.291,
    Female: 11274.026
  },
  {
    Year: 2009,
    Age: '5-9',
    Male: 10456.276,
    Female: 9996.531
  },
  {
    Year: 2009,
    Age: '50-54',
    Male: 10794.455,
    Female: 11044.187
  },
  {
    Year: 2009,
    Age: '55-59',
    Male: 9375.38,
    Female: 9864.436
  },
  {
    Year: 2009,
    Age: '60-64',
    Male: 7631.213,
    Female: 8331.662
  },
  {
    Year: 2009,
    Age: '65-69',
    Male: 5444.827,
    Female: 6225.47
  },
  {
    Year: 2009,
    Age: '70-74',
    Male: 4213.313,
    Female: 4874.69
  },
  {
    Year: 2009,
    Age: '75-79',
    Male: 3118.895,
    Female: 4095.915
  },
  {
    Year: 2009,
    Age: '80-84',
    Male: 2296.581,
    Female: 3440.699
  },
  {
    Year: 2009,
    Age: '85-89',
    Male: 1218.654,
    Female: 2202.098
  },
  {
    Year: 2009,
    Age: '90-94',
    Male: 433.481,
    Female: 1017.404
  },
  {
    Year: 2009,
    Age: '95-99',
    Male: 93.414,
    Female: 301.598
  },
  {
    Year: 2010,
    Age: '0-4',
    Male: 10637.066,
    Female: 10165.18
  },
  {
    Year: 2010,
    Age: '10-14',
    Male: 10659.342,
    Female: 10169.252
  },
  {
    Year: 2010,
    Age: '100+',
    Male: 7.847,
    Female: 44.554
  },
  {
    Year: 2010,
    Age: '15-19',
    Male: 11370.599,
    Female: 10779.498
  },
  {
    Year: 2010,
    Age: '20-24',
    Male: 11092.47,
    Female: 10616.214
  },
  {
    Year: 2010,
    Age: '25-29',
    Male: 10477.059,
    Female: 10273.973
  },
  {
    Year: 2010,
    Age: '30-34',
    Male: 9932.807,
    Female: 9906.885
  },
  {
    Year: 2010,
    Age: '35-39',
    Male: 9966.655,
    Female: 9989.679
  },
  {
    Year: 2010,
    Age: '40-44',
    Male: 10572.973,
    Female: 10363.398
  },
  {
    Year: 2010,
    Age: '45-49',
    Male: 11292.49,
    Female: 11177.608
  },
  {
    Year: 2010,
    Age: '5-9',
    Male: 10548.325,
    Female: 10081.38
  },
  {
    Year: 2010,
    Age: '50-54',
    Male: 10966.383,
    Female: 11180.552
  },
  {
    Year: 2010,
    Age: '55-59',
    Male: 9619.149,
    Female: 10095.283
  },
  {
    Year: 2010,
    Age: '60-64',
    Male: 7991.309,
    Female: 8679.373
  },
  {
    Year: 2010,
    Age: '65-69',
    Male: 5712.776,
    Female: 6539.893
  },
  {
    Year: 2010,
    Age: '70-74',
    Male: 4344.661,
    Female: 5012.046
  },
  {
    Year: 2010,
    Age: '75-79',
    Male: 3161.679,
    Female: 4095.14
  },
  {
    Year: 2010,
    Age: '80-84',
    Male: 2326.775,
    Female: 3465.842
  },
  {
    Year: 2010,
    Age: '85-89',
    Male: 1252.244,
    Female: 2249.636
  },
  {
    Year: 2010,
    Age: '90-94',
    Male: 435.66,
    Female: 1033.798
  },
  {
    Year: 2010,
    Age: '95-99',
    Male: 79.391,
    Female: 274.551
  },
  {
    Year: 2011,
    Age: '0-4',
    Male: 10602.382,
    Female: 10135.166
  },
  {
    Year: 2011,
    Age: '10-14',
    Male: 10613.427,
    Female: 10144.484
  },
  {
    Year: 2011,
    Age: '100+',
    Male: 8.29,
    Female: 45.633
  },
  {
    Year: 2011,
    Age: '15-19',
    Male: 11354.257,
    Female: 10786.075
  },
  {
    Year: 2011,
    Age: '20-24',
    Male: 11268.302,
    Female: 10765.994
  },
  {
    Year: 2011,
    Age: '25-29',
    Male: 10661.076,
    Female: 10416.16
  },
  {
    Year: 2011,
    Age: '30-34',
    Male: 10037.231,
    Female: 9991.877
  },
  {
    Year: 2011,
    Age: '35-39',
    Male: 9920.654,
    Female: 9968.635
  },
  {
    Year: 2011,
    Age: '40-44',
    Male: 10411.53,
    Female: 10244.788
  },
  {
    Year: 2011,
    Age: '45-49',
    Male: 11174.721,
    Female: 11034.48
  },
  {
    Year: 2011,
    Age: '5-9',
    Male: 10571.726,
    Female: 10106.969
  },
  {
    Year: 2011,
    Age: '50-54',
    Male: 11059.368,
    Female: 11237.253
  },
  {
    Year: 2011,
    Age: '55-59',
    Male: 9830.41,
    Female: 10297.327
  },
  {
    Year: 2011,
    Age: '60-64',
    Male: 8269.353,
    Female: 8955.93
  },
  {
    Year: 2011,
    Age: '65-69',
    Male: 6002.095,
    Female: 6859.371
  },
  {
    Year: 2011,
    Age: '70-74',
    Male: 4454.493,
    Female: 5156.074
  },
  {
    Year: 2011,
    Age: '75-79',
    Male: 3217.748,
    Female: 4098.759
  },
  {
    Year: 2011,
    Age: '80-84',
    Male: 2332.061,
    Female: 3430.64
  },
  {
    Year: 2011,
    Age: '85-89',
    Male: 1310.814,
    Female: 2295.65
  },
  {
    Year: 2011,
    Age: '90-94',
    Male: 487.327,
    Female: 1101.429
  },
  {
    Year: 2011,
    Age: '95-99',
    Male: 92.556,
    Female: 298.858
  },
  {
    Year: 2012,
    Age: '0-4',
    Male: 10484.535,
    Female: 10023.765
  },
  {
    Year: 2012,
    Age: '10-14',
    Male: 10593.79,
    Female: 10135.002
  },
  {
    Year: 2012,
    Age: '100+',
    Male: 8.858,
    Female: 46.663
  },
  {
    Year: 2012,
    Age: '15-19',
    Male: 11267.279,
    Female: 10729.805
  },
  {
    Year: 2012,
    Age: '20-24',
    Male: 11445.804,
    Female: 10924.165
  },
  {
    Year: 2012,
    Age: '25-29',
    Male: 10852.242,
    Female: 10560.128
  },
  {
    Year: 2012,
    Age: '30-34',
    Male: 10175.916,
    Female: 10107.796
  },
  {
    Year: 2012,
    Age: '35-39',
    Male: 9908.648,
    Female: 9960.512
  },
  {
    Year: 2012,
    Age: '40-44',
    Male: 10273.964,
    Female: 10166.116
  },
  {
    Year: 2012,
    Age: '45-49',
    Male: 11021.205,
    Female: 10858.88
  },
  {
    Year: 2012,
    Age: '5-9',
    Male: 10604.36,
    Female: 10138.915
  },
  {
    Year: 2012,
    Age: '50-54',
    Male: 11122.409,
    Female: 11252.987
  },
  {
    Year: 2012,
    Age: '55-59',
    Male: 10050.445,
    Female: 10503.912
  },
  {
    Year: 2012,
    Age: '60-64',
    Male: 8504.564,
    Female: 9189.254
  },
  {
    Year: 2012,
    Age: '65-69',
    Male: 6352.918,
    Female: 7221.244
  },
  {
    Year: 2012,
    Age: '70-74',
    Male: 4565.23,
    Female: 5330.419
  },
  {
    Year: 2012,
    Age: '75-79',
    Male: 3306.231,
    Female: 4137.515
  },
  {
    Year: 2012,
    Age: '80-84',
    Male: 2324.454,
    Female: 3383.25
  },
  {
    Year: 2012,
    Age: '85-89',
    Male: 1362.245,
    Female: 2338.841
  },
  {
    Year: 2012,
    Age: '90-94',
    Male: 518.745,
    Female: 1131.97
  },
  {
    Year: 2012,
    Age: '95-99',
    Male: 113.041,
    Female: 337.406
  },
  {
    Year: 2013,
    Age: '0-4',
    Male: 10333.958,
    Female: 9879.853
  },
  {
    Year: 2013,
    Age: '10-14',
    Male: 10589.72,
    Female: 10132.647
  },
  {
    Year: 2013,
    Age: '100+',
    Male: 9.534,
    Female: 47.772
  },
  {
    Year: 2013,
    Age: '15-19',
    Male: 11132.393,
    Female: 10628.202
  },
  {
    Year: 2013,
    Age: '20-24',
    Male: 11603.238,
    Female: 11070.675
  },
  {
    Year: 2013,
    Age: '25-29',
    Male: 11046.105,
    Female: 10705.794
  },
  {
    Year: 2013,
    Age: '30-34',
    Male: 10340.786,
    Female: 10246.164
  },
  {
    Year: 2013,
    Age: '35-39',
    Male: 9929.463,
    Female: 9969.36
  },
  {
    Year: 2013,
    Age: '40-44',
    Male: 10160.689,
    Female: 10118.321
  },
  {
    Year: 2013,
    Age: '45-49',
    Male: 10845.39,
    Female: 10668.871
  },
  {
    Year: 2013,
    Age: '5-9',
    Male: 10643.281,
    Female: 10176.025
  },
  {
    Year: 2013,
    Age: '50-54',
    Male: 11150.146,
    Female: 11227.293
  },
  {
    Year: 2013,
    Age: '55-59',
    Male: 10264.866,
    Female: 10698.233
  },
  {
    Year: 2013,
    Age: '60-64',
    Male: 8711.405,
    Female: 9392.628
  },
  {
    Year: 2013,
    Age: '65-69',
    Male: 6733.652,
    Female: 7600.868
  },
  {
    Year: 2013,
    Age: '70-74',
    Male: 4695.481,
    Female: 5537.938
  },
  {
    Year: 2013,
    Age: '75-79',
    Male: 3416.565,
    Female: 4208.935
  },
  {
    Year: 2013,
    Age: '80-84',
    Male: 2321.077,
    Female: 3341.194
  },
  {
    Year: 2013,
    Age: '85-89',
    Male: 1401.336,
    Female: 2373.95
  },
  {
    Year: 2013,
    Age: '90-94',
    Male: 539.27,
    Female: 1148.206
  },
  {
    Year: 2013,
    Age: '95-99',
    Male: 128.856,
    Female: 366.533
  },
  {
    Year: 2014,
    Age: '0-4',
    Male: 10209.022,
    Female: 9760.021
  },
  {
    Year: 2014,
    Age: '10-14',
    Male: 10588.395,
    Female: 10129.199
  },
  {
    Year: 2014,
    Age: '100+',
    Male: 10.287,
    Female: 49.138
  },
  {
    Year: 2014,
    Age: '15-19',
    Male: 10992.354,
    Female: 10516.859
  },
  {
    Year: 2014,
    Age: '20-24',
    Male: 11707.919,
    Female: 11174.198
  },
  {
    Year: 2014,
    Age: '25-29',
    Male: 11239.13,
    Female: 10855.663
  },
  {
    Year: 2014,
    Age: '30-34',
    Male: 10521.325,
    Female: 10394.973
  },
  {
    Year: 2014,
    Age: '35-39',
    Male: 9981.974,
    Female: 10003.338
  },
  {
    Year: 2014,
    Age: '40-44',
    Male: 10071.178,
    Female: 10085.436
  },
  {
    Year: 2014,
    Age: '45-49',
    Male: 10668.649,
    Female: 10491.897
  },
  {
    Year: 2014,
    Age: '5-9',
    Male: 10676.486,
    Female: 10207.717
  },
  {
    Year: 2014,
    Age: '50-54',
    Male: 11136.553,
    Female: 11161.628
  },
  {
    Year: 2014,
    Age: '55-59',
    Male: 10452.281,
    Female: 10855.929
  },
  {
    Year: 2014,
    Age: '60-64',
    Male: 8916.049,
    Female: 9590.348
  },
  {
    Year: 2014,
    Age: '65-69',
    Male: 7098.26,
    Female: 7962.565
  },
  {
    Year: 2014,
    Age: '70-74',
    Male: 4873.285,
    Female: 5784.9
  },
  {
    Year: 2014,
    Age: '75-79',
    Male: 3534.71,
    Female: 4311.416
  },
  {
    Year: 2014,
    Age: '80-84',
    Male: 2340.017,
    Female: 3324.77
  },
  {
    Year: 2014,
    Age: '85-89',
    Male: 1430.279,
    Female: 2403.282
  },
  {
    Year: 2014,
    Age: '90-94',
    Male: 548.403,
    Female: 1157.211
  },
  {
    Year: 2014,
    Age: '95-99',
    Male: 131.252,
    Female: 370.482
  },
  {
    Year: 2015,
    Age: '0-4',
    Male: 10148.854,
    Female: 9701.799
  },
  {
    Year: 2015,
    Age: '10-14',
    Male: 10587.479,
    Female: 10125.612
  },
  {
    Year: 2015,
    Age: '100+',
    Male: 11.092,
    Female: 50.878
  },
  {
    Year: 2015,
    Age: '15-19',
    Male: 10876.353,
    Female: 10420.613
  },
  {
    Year: 2015,
    Age: '20-24',
    Male: 11738.72,
    Female: 11213.2
  },
  {
    Year: 2015,
    Age: '25-29',
    Male: 11426.922,
    Female: 11009.194
  },
  {
    Year: 2015,
    Age: '30-34',
    Male: 10710.175,
    Female: 10546.518
  },
  {
    Year: 2015,
    Age: '35-39',
    Male: 10065.304,
    Female: 10067.445
  },
  {
    Year: 2015,
    Age: '40-44',
    Male: 10006.501,
    Female: 10058.529
  },
  {
    Year: 2015,
    Age: '45-49',
    Male: 10506.312,
    Female: 10346.295
  },
  {
    Year: 2015,
    Age: '5-9',
    Male: 10686.508,
    Female: 10217.289
  },
  {
    Year: 2015,
    Age: '50-54',
    Male: 11079.893,
    Female: 11059.54
  },
  {
    Year: 2015,
    Age: '55-59',
    Male: 10599.593,
    Female: 10962.671
  },
  {
    Year: 2015,
    Age: '60-64',
    Male: 9133.397,
    Female: 9795.719
  },
  {
    Year: 2015,
    Age: '65-69',
    Male: 7419.475,
    Female: 8284.243
  },
  {
    Year: 2015,
    Age: '70-74',
    Male: 5112.232,
    Female: 6072.977
  },
  {
    Year: 2015,
    Age: '75-79',
    Male: 3655.029,
    Female: 4445.16
  },
  {
    Year: 2015,
    Age: '80-84',
    Male: 2388.707,
    Female: 3343.555
  },
  {
    Year: 2015,
    Age: '85-89',
    Male: 1447.508,
    Female: 2423.005
  },
  {
    Year: 2015,
    Age: '90-94',
    Male: 554.069,
    Female: 1174.647
  },
  {
    Year: 2015,
    Age: '95-99',
    Male: 114.731,
    Female: 341.421
  },
  {
    Year: 2016,
    Age: '0-4',
    Male: 10024.438,
    Female: 9582.098
  },
  {
    Year: 2016,
    Age: '10-14',
    Male: 10644.8,
    Female: 10184.695
  },
  {
    Year: 2016,
    Age: '100+',
    Male: 11.967,
    Female: 53.145
  },
  {
    Year: 2016,
    Age: '15-19',
    Male: 10834.653,
    Female: 10396.113
  },
  {
    Year: 2016,
    Age: '20-24',
    Male: 11714.69,
    Female: 11205.388
  },
  {
    Year: 2016,
    Age: '25-29',
    Male: 11607.911,
    Female: 11161.227
  },
  {
    Year: 2016,
    Age: '30-34',
    Male: 10903.306,
    Female: 10696.455
  },
  {
    Year: 2016,
    Age: '35-39',
    Male: 10179.211,
    Female: 10160.212
  },
  {
    Year: 2016,
    Age: '40-44',
    Male: 9969.972,
    Female: 10044.658
  },
  {
    Year: 2016,
    Age: '45-49',
    Male: 10356.423,
    Female: 10235.875
  },
  {
    Year: 2016,
    Age: '5-9',
    Male: 10668.504,
    Female: 10200.51
  },
  {
    Year: 2016,
    Age: '50-54',
    Male: 10976.001,
    Female: 10926.665
  },
  {
    Year: 2016,
    Age: '55-59',
    Male: 10703.154,
    Female: 11026.589
  },
  {
    Year: 2016,
    Age: '60-64',
    Male: 9349.162,
    Female: 9998.324
  },
  {
    Year: 2016,
    Age: '65-69',
    Male: 7685.919,
    Female: 8552.504
  },
  {
    Year: 2016,
    Age: '70-74',
    Male: 5383.385,
    Female: 6375.326
  },
  {
    Year: 2016,
    Age: '75-79',
    Male: 3755.166,
    Female: 4577.159
  },
  {
    Year: 2016,
    Age: '80-84',
    Male: 2445.889,
    Female: 3354.231
  },
  {
    Year: 2016,
    Age: '85-89',
    Male: 1469.106,
    Female: 2412.195
  },
  {
    Year: 2016,
    Age: '90-94',
    Male: 611.475,
    Female: 1244.355
  },
  {
    Year: 2016,
    Age: '95-99',
    Male: 130.23,
    Female: 366.519
  },
  {
    Year: 2017,
    Age: '0-4',
    Male: 10084.672,
    Female: 9639.208
  },
  {
    Year: 2017,
    Age: '10-14',
    Male: 10699.017,
    Female: 10239.561
  },
  {
    Year: 2017,
    Age: '100+',
    Male: 12.887,
    Female: 55.753
  },
  {
    Year: 2017,
    Age: '15-19',
    Male: 10811.426,
    Female: 10383.06
  },
  {
    Year: 2017,
    Age: '20-24',
    Male: 11616.045,
    Female: 11134.63
  },
  {
    Year: 2017,
    Age: '25-29',
    Male: 11780.236,
    Female: 11314.364
  },
  {
    Year: 2017,
    Age: '30-34',
    Male: 11091.657,
    Female: 10838.458
  },
  {
    Year: 2017,
    Age: '35-39',
    Male: 10316.32,
    Female: 10274.895
  },
  {
    Year: 2017,
    Age: '40-44',
    Male: 9957.386,
    Female: 10035.572
  },
  {
    Year: 2017,
    Age: '45-49',
    Male: 10219.812,
    Female: 10156.838
  },
  {
    Year: 2017,
    Age: '5-9',
    Male: 10583.223,
    Female: 10119.603
  },
  {
    Year: 2017,
    Age: '50-54',
    Male: 10826.346,
    Female: 10753.193
  },
  {
    Year: 2017,
    Age: '55-59',
    Male: 10767.139,
    Female: 11042.774
  },
  {
    Year: 2017,
    Age: '60-64',
    Male: 9564.501,
    Female: 10199.184
  },
  {
    Year: 2017,
    Age: '65-69',
    Male: 7908.45,
    Female: 8776.222
  },
  {
    Year: 2017,
    Age: '70-74',
    Male: 5706.475,
    Female: 6715.668
  },
  {
    Year: 2017,
    Age: '75-79',
    Male: 3853.34,
    Female: 4734.687
  },
  {
    Year: 2017,
    Age: '80-84',
    Male: 2521.728,
    Female: 3389.457
  },
  {
    Year: 2017,
    Age: '85-89',
    Male: 1473.527,
    Female: 2383.718
  },
  {
    Year: 2017,
    Age: '90-94',
    Male: 645.573,
    Female: 1277.27
  },
  {
    Year: 2017,
    Age: '95-99',
    Male: 153.312,
    Female: 402.281
  },
  {
    Year: 2018,
    Age: '0-4',
    Male: 10266.944,
    Female: 9812.992
  },
  {
    Year: 2018,
    Age: '10-14',
    Male: 10744.803,
    Female: 10284.406
  },
  {
    Year: 2018,
    Age: '100+',
    Male: 13.849,
    Female: 58.568
  },
  {
    Year: 2018,
    Age: '15-19',
    Male: 10802.851,
    Female: 10378.093
  },
  {
    Year: 2018,
    Age: '20-24',
    Male: 11476.549,
    Female: 11028.696
  },
  {
    Year: 2018,
    Age: '25-29',
    Male: 11928.832,
    Female: 11453.713
  },
  {
    Year: 2018,
    Age: '30-34',
    Male: 11277.376,
    Female: 10977.75
  },
  {
    Year: 2018,
    Age: '35-39',
    Male: 10474.477,
    Female: 10407.968
  },
  {
    Year: 2018,
    Age: '40-44',
    Male: 9973.505,
    Female: 10040.238
  },
  {
    Year: 2018,
    Age: '45-49',
    Male: 10103.752,
    Female: 10105.587
  },
  {
    Year: 2018,
    Age: '5-9',
    Male: 10444.074,
    Female: 9987.552
  },
  {
    Year: 2018,
    Age: '50-54',
    Male: 10651.506,
    Female: 10562.662
  },
  {
    Year: 2018,
    Age: '55-59',
    Male: 10792.75,
    Female: 11015.533
  },
  {
    Year: 2018,
    Age: '60-64',
    Male: 9769.858,
    Female: 10386.551
  },
  {
    Year: 2018,
    Age: '65-69',
    Male: 8105.592,
    Female: 8972.238
  },
  {
    Year: 2018,
    Age: '70-74',
    Male: 6055.109,
    Female: 7073.007
  },
  {
    Year: 2018,
    Age: '75-79',
    Male: 3969.582,
    Female: 4922.977
  },
  {
    Year: 2018,
    Age: '80-84',
    Male: 2612.057,
    Female: 3452.011
  },
  {
    Year: 2018,
    Age: '85-89',
    Male: 1473.535,
    Female: 2354.346
  },
  {
    Year: 2018,
    Age: '90-94',
    Male: 664.214,
    Female: 1292.125
  },
  {
    Year: 2018,
    Age: '95-99',
    Male: 170.492,
    Female: 428.032
  },
  {
    Year: 2019,
    Age: '0-4',
    Male: 10469.069,
    Female: 10005.344
  },
  {
    Year: 2019,
    Age: '10-14',
    Male: 10761.743,
    Female: 10299.191
  },
  {
    Year: 2019,
    Age: '100+',
    Male: 14.848,
    Female: 61.404
  },
  {
    Year: 2019,
    Age: '15-19',
    Male: 10802.816,
    Female: 10377.504
  },
  {
    Year: 2019,
    Age: '20-24',
    Male: 11346.246,
    Female: 10928.883
  },
  {
    Year: 2019,
    Age: '25-29',
    Male: 12030.752,
    Female: 11555.843
  },
  {
    Year: 2019,
    Age: '30-34',
    Male: 11465.625,
    Female: 11124.035
  },
  {
    Year: 2019,
    Age: '35-39',
    Male: 10650.706,
    Female: 10553.608
  },
  {
    Year: 2019,
    Age: '40-44',
    Male: 10024.13,
    Female: 10072.469
  },
  {
    Year: 2019,
    Age: '45-49',
    Male: 10015.246,
    Female: 10072.232
  },
  {
    Year: 2019,
    Age: '5-9',
    Male: 10295.367,
    Female: 9846.2
  },
  {
    Year: 2019,
    Age: '50-54',
    Male: 10480.136,
    Female: 10388.302
  },
  {
    Year: 2019,
    Age: '55-59',
    Male: 10781.624,
    Female: 10952.238
  },
  {
    Year: 2019,
    Age: '60-64',
    Male: 9951.71,
    Female: 10542.703
  },
  {
    Year: 2019,
    Age: '65-69',
    Male: 8306.563,
    Female: 9168.285
  },
  {
    Year: 2019,
    Age: '70-74',
    Male: 6392.165,
    Female: 7417.535
  },
  {
    Year: 2019,
    Age: '75-79',
    Male: 4132.347,
    Female: 5151.972
  },
  {
    Year: 2019,
    Age: '80-84',
    Male: 2710.008,
    Female: 3545.917
  },
  {
    Year: 2019,
    Age: '85-89',
    Male: 1487.96,
    Female: 2347.064
  },
  {
    Year: 2019,
    Age: '90-94',
    Male: 667.565,
    Female: 1295.048
  },
  {
    Year: 2019,
    Age: '95-99',
    Male: 171.817,
    Female: 428.887
  },
  {
    Year: 2020,
    Age: '0-4',
    Male: 10619.145,
    Female: 10147.107
  },
  {
    Year: 2020,
    Age: '10-14',
    Male: 10726.529,
    Female: 10262.068
  },
  {
    Year: 2020,
    Age: '100+',
    Male: 15.879,
    Female: 64.114
  },
  {
    Year: 2020,
    Age: '15-19',
    Male: 10805.887,
    Female: 10377.72
  },
  {
    Year: 2020,
    Age: '20-24',
    Male: 11252.131,
    Female: 10856.426
  },
  {
    Year: 2020,
    Age: '25-29',
    Male: 12071.84,
    Female: 11605.684
  },
  {
    Year: 2020,
    Age: '30-34',
    Male: 11656.492,
    Female: 11280.656
  },
  {
    Year: 2020,
    Age: '35-39',
    Male: 10840.886,
    Female: 10706.459
  },
  {
    Year: 2020,
    Age: '40-44',
    Male: 10110.863,
    Female: 10139.026
  },
  {
    Year: 2020,
    Age: '45-49',
    Male: 9957.831,
    Female: 10049.746
  },
  {
    Year: 2020,
    Age: '5-9',
    Male: 10200.215,
    Female: 9755.346
  },
  {
    Year: 2020,
    Age: '50-54',
    Male: 10329.611,
    Female: 10250.005
  },
  {
    Year: 2020,
    Age: '55-59',
    Male: 10735.025,
    Female: 10858.435
  },
  {
    Year: 2020,
    Age: '60-64',
    Male: 10101.177,
    Female: 10655.679
  },
  {
    Year: 2020,
    Age: '65-69',
    Male: 8525.752,
    Female: 9378.168
  },
  {
    Year: 2020,
    Age: '70-74',
    Male: 6696.349,
    Female: 7730.721
  },
  {
    Year: 2020,
    Age: '75-79',
    Male: 4354.942,
    Female: 5425.552
  },
  {
    Year: 2020,
    Age: '80-84',
    Male: 2813.559,
    Female: 3673.619
  },
  {
    Year: 2020,
    Age: '85-89',
    Male: 1525.404,
    Female: 2375.261
  },
  {
    Year: 2020,
    Age: '90-94',
    Male: 660.527,
    Female: 1293.449
  },
  {
    Year: 2020,
    Age: '95-99',
    Male: 150.75,
    Female: 395.492
  },
  {
    Year: 2021,
    Age: '0-4',
    Male: 10850.407,
    Female: 10366.268
  },
  {
    Year: 2021,
    Age: '10-14',
    Male: 10674.36,
    Female: 10217.468
  },
  {
    Year: 2021,
    Age: '100+',
    Male: 16.928,
    Female: 66.627
  },
  {
    Year: 2021,
    Age: '15-19',
    Male: 10853.221,
    Female: 10427.996
  },
  {
    Year: 2021,
    Age: '20-24',
    Male: 11183.803,
    Female: 10804.103
  },
  {
    Year: 2021,
    Age: '25-29',
    Male: 12034.064,
    Female: 11585.087
  },
  {
    Year: 2021,
    Age: '30-34',
    Male: 11825.869,
    Female: 11424.162
  },
  {
    Year: 2021,
    Age: '35-39',
    Male: 11022.635,
    Female: 10847.613
  },
  {
    Year: 2021,
    Age: '40-44',
    Male: 10212.981,
    Female: 10222.303
  },
  {
    Year: 2021,
    Age: '45-49',
    Male: 9911.005,
    Female: 10026.323
  },
  {
    Year: 2021,
    Age: '5-9',
    Male: 10175.91,
    Female: 9733.71
  },
  {
    Year: 2021,
    Age: '50-54',
    Male: 10173.502,
    Female: 10132.237
  },
  {
    Year: 2021,
    Age: '55-59',
    Male: 10627.418,
    Female: 10718.923
  },
  {
    Year: 2021,
    Age: '60-64',
    Male: 10195.044,
    Female: 10706.704
  },
  {
    Year: 2021,
    Age: '65-69',
    Male: 8722.5,
    Female: 9562.607
  },
  {
    Year: 2021,
    Age: '70-74',
    Male: 6931.581,
    Female: 7971.23
  },
  {
    Year: 2021,
    Age: '75-79',
    Male: 4591.662,
    Female: 5691.965
  },
  {
    Year: 2021,
    Age: '80-84',
    Male: 2894.988,
    Female: 3780.977
  },
  {
    Year: 2021,
    Age: '85-89',
    Male: 1582.782,
    Female: 2397.16
  },
  {
    Year: 2021,
    Age: '90-94',
    Male: 700.441,
    Female: 1327.372
  },
  {
    Year: 2021,
    Age: '95-99',
    Male: 168.432,
    Female: 422.829
  },
  {
    Year: 2022,
    Age: '0-4',
    Male: 10966.784,
    Female: 10477.01
  },
  {
    Year: 2022,
    Age: '10-14',
    Male: 10571.666,
    Female: 10122.312
  },
  {
    Year: 2022,
    Age: '100+',
    Male: 17.999,
    Female: 68.999
  },
  {
    Year: 2022,
    Age: '15-19',
    Male: 10921.705,
    Female: 10496.8
  },
  {
    Year: 2022,
    Age: '20-24',
    Male: 11156.465,
    Female: 10785.011
  },
  {
    Year: 2022,
    Age: '25-29',
    Male: 11940.156,
    Female: 11517.603
  },
  {
    Year: 2022,
    Age: '30-34',
    Male: 12001.803,
    Female: 11581.44
  },
  {
    Year: 2022,
    Age: '35-39',
    Male: 11214.123,
    Female: 10993.193
  },
  {
    Year: 2022,
    Age: '40-44',
    Male: 10352.37,
    Female: 10339.663
  },
  {
    Year: 2022,
    Age: '45-49',
    Male: 9901.927,
    Female: 10020.078
  },
  {
    Year: 2022,
    Age: '5-9',
    Male: 10226.232,
    Female: 9781.31
  },
  {
    Year: 2022,
    Age: '50-54',
    Male: 10044.226,
    Female: 10057.744
  },
  {
    Year: 2022,
    Age: '55-59',
    Male: 10489.912,
    Female: 10553.427
  },
  {
    Year: 2022,
    Age: '60-64',
    Male: 10266.263,
    Female: 10726.669
  },
  {
    Year: 2022,
    Age: '65-69',
    Male: 8933.032,
    Female: 9759.642
  },
  {
    Year: 2022,
    Age: '70-74',
    Male: 7141.293,
    Female: 8184.45
  },
  {
    Year: 2022,
    Age: '75-79',
    Male: 4880.059,
    Female: 6003.354
  },
  {
    Year: 2022,
    Age: '80-84',
    Male: 2977.288,
    Female: 3914.524
  },
  {
    Year: 2022,
    Age: '85-89',
    Male: 1643.735,
    Female: 2428.265
  },
  {
    Year: 2022,
    Age: '90-94',
    Male: 713.078,
    Female: 1319.828
  },
  {
    Year: 2022,
    Age: '95-99',
    Male: 195.003,
    Female: 463.27
  },
  {
    Year: 2023,
    Age: '0-4',
    Male: 10998.811,
    Female: 10507.94
  },
  {
    Year: 2023,
    Age: '10-14',
    Male: 10435.071,
    Female: 9992.282
  },
  {
    Year: 2023,
    Age: '100+',
    Male: 19.088,
    Female: 71.27
  },
  {
    Year: 2023,
    Age: '15-19',
    Male: 10983.874,
    Female: 10557.347
  },
  {
    Year: 2023,
    Age: '20-24',
    Male: 11162.741,
    Female: 10793.764
  },
  {
    Year: 2023,
    Age: '25-29',
    Male: 11814.897,
    Female: 11423.514
  },
  {
    Year: 2023,
    Age: '30-34',
    Male: 12162.099,
    Female: 11731.275
  },
  {
    Year: 2023,
    Age: '35-39',
    Male: 11410.404,
    Female: 11142.202
  },
  {
    Year: 2023,
    Age: '40-44',
    Male: 10520.218,
    Female: 10481.531
  },
  {
    Year: 2023,
    Age: '45-49',
    Male: 9928.593,
    Female: 10033.878
  },
  {
    Year: 2023,
    Age: '5-9',
    Male: 10352.964,
    Female: 9900.736
  },
  {
    Year: 2023,
    Age: '50-54',
    Male: 9942.13,
    Female: 10016.571
  },
  {
    Year: 2023,
    Age: '55-59',
    Male: 10334.804,
    Female: 10377.47
  },
  {
    Year: 2023,
    Age: '60-64',
    Male: 10307.779,
    Female: 10712.787
  },
  {
    Year: 2023,
    Age: '65-69',
    Male: 9142.935,
    Female: 9952.275
  },
  {
    Year: 2023,
    Age: '70-74',
    Male: 7338.639,
    Female: 8381.885
  },
  {
    Year: 2023,
    Age: '75-79',
    Male: 5194.603,
    Female: 6337.059
  },
  {
    Year: 2023,
    Age: '80-84',
    Male: 3078.985,
    Female: 4080.144
  },
  {
    Year: 2023,
    Age: '85-89',
    Male: 1705.84,
    Female: 2473.964
  },
  {
    Year: 2023,
    Age: '90-94',
    Male: 715.765,
    Female: 1301.817
  },
  {
    Year: 2023,
    Age: '95-99',
    Male: 213.655,
    Female: 490.104
  }
];

const yearData = new Map();

data.forEach(d => {
  const year = d.Year;
  if (!yearData.has(year)) {
    yearData.set(year, { male: [], female: [] });
  }
  const male = { type: 'male', year, population: d.Male, age: d.Age };
  const female = { type: 'female', year, population: d.Female, age: d.Age };
  yearData.get(year).male.push(male);
  yearData.get(year).female.push(female);
});
const dataSpec = Array.from(yearData.keys()).map(year => {
  const male = yearData.get(year).male.sort((a, b) => {
    if (a.age === '100+') {
      return 1;
    }
    if (b.age === '100+') {
      return -1;
    }
    return a.age.split('-')[0] - b.age.split('-')[0];
  });
  const female = yearData.get(year).female.sort((a, b) => {
    if (a.age === '100+') {
      return 1;
    }
    if (b.age === '100+') {
      return -1;
    }
    return a.age.split('-')[0] - b.age.split('-')[0];
  });
  return {
    data: [
      {
        id: 'maleData',
        values: male
      },
      {
        id: 'femaleData',
        values: female
      }
    ]
  };
});

const spec = {
  type: 'common',
  title: {
    id: 'title',
    visible: true,
    text: 'Congo Population Pyramid 2021'
  },
  layout: {
    type: 'grid',
    col: 4,
    row: 5,
    elements: [
      { modelId: 'title', col: 0, row: 0, colSpan: 4 },

      { modelId: 'legend', col: 0, row: 1, colSpan: 4 },

      { modelId: 'leftAxesCountry', col: 0, row: 2 },
      { modelId: 'leftRegion', col: 1, row: 2 },
      { modelId: 'leftAxesValue', col: 1, row: 3 },

      { modelId: 'rightRegion', col: 2, row: 2 },
      { modelId: 'rightAxesCountry', col: 3, row: 2 },
      { modelId: 'rightAxesValue', col: 2, row: 3 },
      { modelId: 'player', col: 0, row: 4, colSpan: 4 }
    ]
  },
  region: [{ id: 'leftRegion' }, { id: 'rightRegion' }],
  player: {
    id: 'player',
    orient: 'bottom',
    auto: true,
    interval: 300,
    specs: dataSpec
  },
  legends: [
    {
      visible: true,
      orient: 'bottom',
      id: 'legend',
      position: 'start',
      interactive: false
    }
  ],

  data: dataSpec[0].data,
  animationExit: false,
  series: [
    {
      id: 'male',
      regionId: 'leftRegion',
      type: 'bar',
      dataId: 'maleData',
      direction: 'horizontal',
      xField: 'population',
      yField: 'age',
      bar: {
        style: {
          fill: 'steelblue'
        }
      },
      label: {
        visible: true,
        position: 'left',
        overlap: false,
        style: {
          fontSize: 12,
          fill: '#6F6F6F'
        },
        formatMethod: val => `${val.toFixed(1)}`
      },
      tooltip: {
        mark: {
          content: [
            {
              key: datum => datum.age,
              value: datum => `${(datum.population / 100).toFixed(1)}`
            }
          ]
        },
        dimension: {
          content: [
            {
              key: datum => datum.age
            }
          ]
        }
      }
    },
    {
      id: 'female',
      regionId: 'rightRegion',
      type: 'bar',
      dataId: 'femaleData',
      direction: 'horizontal',
      xField: 'population',
      yField: 'age',
      bar: {
        style: {
          fill: '#EE7989'
        }
      },
      label: {
        visible: true,
        overlap: false,
        style: {
          fontSize: 12,
          fill: '#6F6F6F'
        },
        formatMethod: val => `${val.toFixed(1)}`
      },
      tooltip: {
        mark: {
          content: [
            {
              key: datum => datum.age,
              value: datum => `${(datum.population / 100).toFixed(1)}`
            }
          ]
        },
        dimension: {
          content: [
            {
              key: datum => datum.age,
              value: datum => `${(datum.population / 100).toFixed(1)}`
            }
          ]
        }
      }
    }
  ],
  axes: [
    {
      id: 'leftAxesCountry',
      regionId: 'leftRegion',
      seriesId: ['male'],
      orient: 'left',
      type: 'band',
      grid: { visible: true, style: { lineDash: [0] } }
    },
    {
      id: 'rightAxesCountry',
      regionId: 'rightRegion',
      seriesId: ['female'],
      orient: 'right',
      type: 'band',
      grid: { visible: true, style: { lineDash: [0] } }
    },
    {
      id: 'leftAxesValue',
      regionId: 'leftRegion',
      seriesId: ['male'],
      orient: 'bottom',
      type: 'linear',
      inverse: true,
      grid: { visible: true, style: { lineDash: [0] } },
      min: 0,
      max: 2e4,
      label: {
        formatMethod: val => {
          return `${(val / 1000).toFixed(0)}M`;
        }
      }
    },
    {
      id: 'rightAxesValue',
      regionId: 'rightRegion',
      seriesId: ['female'],
      orient: 'bottom',
      type: 'linear',
      grid: { visible: true, style: { lineDash: [0] } },
      min: 0,
      max: 2e4,
      label: {
        animation: { increaseEffect: true },
        formatMethod: val => {
          return `${(val / 1000).toFixed(0)}M`;
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
setInterval(function () {
  for (let j = 0; j < 5; j++) {
    data.shift();
    data.push(generateData(++i));
  }
  vchart.updateData('id0', data);
}, duration);

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
