---
title: 107. 组合图折线图被遮住，导致无法hover出tooltip</br>
---
## 问题标题

组合图折线图被遮住，导致无法hover出tooltip</br>
## 问题描述

组合图折线图被柱子遮住了，导致hover无法出tooltip</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MDeQbH5dEowVloxhWlCcpxOznIf.gif' alt='' width='3820' height='1682'>

## 解决方案 

可以调整一下 series 声明的顺序，先申明 bar series 再声明 line series，这样折线会展示在柱子的上面：</br>


## 相关文档

*  教程：https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination</br>
*  API：https://visactor.io/vchart/option/commonChart</br>
*  Github：https://github.com/VisActor/VChart/</br>

