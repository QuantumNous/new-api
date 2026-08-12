# Can users click on data points within the VChart to show a list of actions?

## Question Description

How can a data point in the chart be clicked to trigger a display of available actions, just like shown in this screenshot?

![tooltip](/vchart/faq/42-0.png)

## Solution

This can be achieved through the event interaction of the VChart chart

1. Register click events for chart elements
2. Through the event callback parameter, you can get the information of the click event, such as event position
3. render a menu, add the actions you need to respond to in the menu

## Code Example

```javascript
vchart.on('pointerdown', { level: 'mark' }, ({ event }) => {
  // show your menu
  event.preventDefault();
  menu.style.display = 'block';
  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY}px`;
});
```

## Result

![demo](/vchart/faq/42-1.png)

Demo: [https://codesandbox.io/s/click-menu-m42d9j](https://codesandbox.io/s/click-menu-m42d9j)

## Quote

Event option: [https://visactor.io/vchart/api/API/event](https://visactor.io/vchart/api/API/event)

Event tutorials: [https://visactor.io/vchart/guide/tutorial_docs/Event](https://visactor.io/vchart/guide/tutorial_docs/Event)

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
