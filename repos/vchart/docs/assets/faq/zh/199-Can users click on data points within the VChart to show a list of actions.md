# VChart 图表点击数据点，展示操作列表？

## 问题描述

类似这个截图里的效果，如何实现点击图表中的一个数据点，能够展示出一个操作的列表？

![tooltip](/vchart/faq/42-0.png)

## 解决方案

通过 VChart 图表的事件交互可以实现这个功能

1. 注册图表元素的点击事件
2. 通过事件回调参数可以拿到点击事件的信息，例如事件坐标等
3. 渲染一个菜单，菜单中添加你需要响应的操作

## 代码示例

```javascript
vchart.on('pointerdown', { level: 'mark' }, ({ event }) => {
  // show your menu
  event.preventDefault();
  menu.style.display = 'block';
  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY}px`;
});
```

## 结果展示

![demo](/vchart/faq/42-1.png)

Demo: [https://codesandbox.io/s/click-menu-m42d9j](https://codesandbox.io/s/click-menu-m42d9j)

## 相关文档

Event option: [https://visactor.io/vchart/api/API/event](https://visactor.io/vchart/api/API/event)

Event tutorials: [https://visactor.io/vchart/guide/tutorial_docs/Event](https://visactor.io/vchart/guide/tutorial_docs/Event)

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
