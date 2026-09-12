---
category: examples
group: calendar chart
title: Calendar
keywords: calendarChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/preview/calendar-basic.png
link: '../guide/calendar/introduction'
option: Calendar#startDate
---

# Calendar

Guid: https://visactor.io/vtable/guide/calendar/Getting_Started.

Calendar basic usage.

## Key Configurations

- `Calendar`

## Code demo

```javascript livedemo template=vtable
const unicColorPool = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'gray'];

const customEvents = [];
// add 20 list event
for (let i = 0; i < 20; i++) {
  customEvents.push({
    date: new Date(Date.now() + Math.floor((Math.random() - 0.5) * 2629800000)),
    text: `List Event ${i}`,
    id: `list-event-${i}`,
    type: 'list',
    color: unicColorPool[i % unicColorPool.length]
  });
}

// add 10 bar event
for (let i = 0; i < 10; i++) {
  const randomDate = Date.now() + Math.floor((Math.random() - 0.5) * 2629800000);
  const randomDays = 86400000 * Math.floor((Math.random() - 0.5) * 5);
  customEvents.push({
    startDate: new Date(randomDate - randomDays),
    endDate: new Date(randomDate + randomDays),
    type: 'bar',
    text: `Bar Event ${i}`,
    id: `bar-event-${i}`,
    color: '#FFF',
    bgColor: unicColorPool[i % unicColorPool.length]
  });
}

const calendar = new VTableCalendar.Calendar(document.getElementById(CONTAINER_ID), {
  tableOptions: {
    theme: {
      headerStyle: {
        color: args => {
          if (args.col === 0) {
            return 'red';
          }
          return '#000';
        }
      }
    }
  },
  customEvents
});

window['calendar'] = calendar;
```
