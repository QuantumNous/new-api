---
category: examples
group: calendar chart
title: Calendar custom event
keywords: calendarChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/preview/calendar-custom-event.gif
link: '../guide/calendar/introduction'
option: Calendar#startDate
---

# Calendar Custom Event

Guid: https://visactor.io/vtable/guide/calendar/Getting_Started.

Custom event in Calendar.

## Key Configurations

- `addCustomEvent` Add custom event
- `removeCustomEvent` Remove custom event

## Code demo

```javascript livedemo template=vtable
const unicColorPool = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'gray'];

const customEvents = [];
const container = document.getElementById(CONTAINER_ID);
const calendar = new VTableCalendar.Calendar(container, {
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
  }
});

const info = document.createElement('div');
info.innerText = 'Select Date and Click Button';
info.style.position = 'absolute';
info.style.top = '10px';
info.style.right = '210px';
info.style.zIndex = '100';
info.style.color = '#999';
container?.appendChild(info);

const bottomAddButton = document.createElement('button');
bottomAddButton.innerText = 'Add Event';
bottomAddButton.style.position = 'absolute';
bottomAddButton.style.top = '10px';
bottomAddButton.style.right = '110px';
bottomAddButton.style.zIndex = '100';
container?.appendChild(bottomAddButton);

let listEventIndex = 0;
let barEventIndex = 0;
bottomAddButton.addEventListener('click', () => {
  const selectedDates = calendar.selectedDate;
  if (selectedDates.length === 0) {
    return;
  }

  if (selectedDates.length > 1) {
    const startDate = selectedDates[0].date;
    const endDate = selectedDates[selectedDates.length - 1].date;
    calendar.addCustomEvent({
      id: `bar-event-${barEventIndex}`,
      startDate,
      endDate,
      text: `Bar Event ${barEventIndex}`,
      type: 'bar',
      bgColor: unicColorPool[barEventIndex % unicColorPool.length],
      color: '#fff'
    });
    barEventIndex++;
  } else {
    const date = selectedDates[0].date;
    calendar.addCustomEvent({
      id: `list-event-${listEventIndex}`,
      date,
      text: `List Event ${listEventIndex}`,
      type: 'list',
      color: unicColorPool[listEventIndex % unicColorPool.length]
    });
    listEventIndex++;
  }
});

const bottomDeleteButton = document.createElement('button');
bottomDeleteButton.innerText = 'Delete Event';
bottomDeleteButton.style.position = 'absolute';
bottomDeleteButton.style.top = '10px';
bottomDeleteButton.style.right = '10px';
bottomDeleteButton.style.zIndex = '100';
container?.appendChild(bottomDeleteButton);
bottomDeleteButton.addEventListener('click', () => {
  const selectedDates = calendar.selectedDate;
  if (selectedDates.length === 0) {
    return;
  }

  const idSet = new Set();
  selectedDates.map(data => {
    calendar.getCellCustomEventByLocation(data.col, data.row).map(event => {
      event.id && idSet.add(event.id);
    });
  });

  calendar.removeCustomEvents(Array.from(idSet));
});

window['calendar'] = calendar;
```
