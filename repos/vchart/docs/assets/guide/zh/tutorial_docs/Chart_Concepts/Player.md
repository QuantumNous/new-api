# Player 播放器

Player 播放器主要作用是增强动态叙事能力，支持播放、暂停播放、前进、后退等基本功能，帮助用户动态地展示序列数据。根据其支持的数据类型可以分为离散型和连续型两种播放类型。通过使用 Player 组件，用户可以在图表中回溯数据变化情况，帮助用户更加直观地观察数据的变化。本教程主要讲解 Player 的相关概念以及组成，关于 Player 更加详细的配置及示例，请参见[配置项文档](../../../option)及[示例](../../../example)页面。

## 组成

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c618.png" alt="Player 图示">
</div>

Player 组件由 2 个模块组成：

- 控制器
  - 播放按钮/暂停按钮
  - 前进按钮
  - 后退按钮
- 滑动条
  - 轨道
  - 滑动轨迹
  - 手柄

## 分类

根据播放器的展示类型，Player 播放器可以分为两类：

1.  离散型：数据按照离散的时间点播放，例如某一个季度的销售数据。
2.  连续型：数据在时间轴上连续播放，例如股票价格的实时变化。

## 示例

- [基础播放器(离散型)](../../../demo/player/basic-player)
- [基础播放器(连续型)](../../../demo/player/continuous-player)
- [ranking-bar](../../../demo/player/ranking-bar)
- [timeline-scatter](../../../demo/player/timeline-scatter)
