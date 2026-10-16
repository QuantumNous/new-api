---
category: examples
group: pictogram chart
title: SVG Swimming Animation
keywords: pictogramChart, animation
order: 26-7
cover: /vchart/preview/swimming.png
option: pictogramChart
---

# SVG Swimming Animation

> Contributed by [ZhangJhxx](https://github.com/ZhangJhxx)

This is a animation of people competing in a swimming pool.

## Key Configurations

- Load all the SVG resources needed using fetch api
- Draw extended pictograms of paths and figures using `customMark`;
- Loop all the people figures and create forward animation for each of them;
- Use callback to draw the backwards animation;

## Code Demo

```javascript livedemo
/** --Please add the following code when using in your project-- */
// For version 1.x, please additionally import and execute registerPictogramChart in your project
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
// For version 2.0.0, please additionally import and execute registerPictogramChart in your project
// import { registerPictogramChart } from '@visactor/vchart-extension';
// registerPictogramChart();
/** --Please add the above code when using in your project-- */

/** --Please remove the following code when using in your project-- */
if (VCHART_MODULE.registerPictogramChart) {
  // Execute registration code for version 1.x
  VCHART_MODULE.registerPictogramChart();
} else if (VChartExtension.registerPictogramChart) {
  // Execute registration code for version 2.0.0
  VChartExtension.registerPictogramChart();
}

const response = await fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/swimmingPool.svg');
const routeSVG = await response.text();

const [
  brownPeopleResponse1,
  brownPeopleResponse2,
  whitePeopleResponse1,
  whitePeopleResponse2,
  yellowPeopleResponse1,
  yellowPeopleResponse2,
  tanPeopleResponse1,
  tanPeopleResponse2,
  blackPeopleResponse1,
  blackPeopleResponse2
] = await Promise.all([
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/brownPeople1.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/brownPeople2.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/whitePeople1.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/whitePeople2.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/yellowPeople1.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/yellowPeople2.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/tanPeople1.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/tanPeople2.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/blackPeople1.svg'),
  fetch('https://lf3-static.bytednsdoc.com/obj/eden-cn/oqeh7nuvonuhpqnuhog/blackPeople2.svg')
]);

const [
  brownPeople1,
  brownPeople2,
  whitePeople1,
  whitePeople2,
  yellowPeople1,
  yellowPeople2,
  tanPeople1,
  tanPeople2,
  blackPeople1,
  blackPeople2
] = await Promise.all([
  brownPeopleResponse1.text(),
  brownPeopleResponse2.text(),
  whitePeopleResponse1.text(),
  whitePeopleResponse2.text(),
  yellowPeopleResponse1.text(),
  yellowPeopleResponse2.text(),
  tanPeopleResponse1.text(),
  tanPeopleResponse2.text(),
  blackPeopleResponse1.text(),
  blackPeopleResponse2.text()
]);

const points5 = [
  {
    x: 40,
    y: 351
  },
  {
    x: 920,
    y: 351
  }
];

const flippedPoints5 = [
  {
    x: 920,
    y: 351
  },
  {
    x: 40,
    y: 351
  }
];

const points4 = [
  {
    x: 40,
    y: 269
  },
  {
    x: 920,
    y: 269
  }
];

const flippedPoints4 = [
  {
    x: 920,
    y: 269
  },
  {
    x: 40,
    y: 269
  }
];

const points3 = [
  {
    x: 40,
    y: 187
  },
  {
    x: 920,
    y: 187
  }
];

const flippedPoints3 = [
  {
    x: 920,
    y: 187
  },
  {
    x: 40,
    y: 187
  }
];

const points2 = [
  {
    x: 40,
    y: 105
  },
  {
    x: 920,
    y: 105
  }
];

const flippedPoints2 = [
  {
    x: 920,
    y: 105
  },
  {
    x: 40,
    y: 105
  }
];

const points1 = [
  {
    x: 40,
    y: 20
  },
  {
    x: 920,
    y: 20
  }
];

const flippedPoints1 = [
  {
    x: 920,
    y: 20
  },
  {
    x: 40,
    y: 20
  }
];

const spec = {
  type: 'pictogram',
  height: 500,
  data: {
    id: 'data',
    values: []
  },
  region: [
    {
      roam: { blank: true }
    }
  ],
  customMark: [
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'people',
      animation: true,
      style: {
        x: 40,
        y: 20,
        size: 90,
        fill: '#CD853F',
        symbolType: brownPeople1
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'flippedPeople',
      animation: true,
      style: {
        x: 920,
        y: 40,
        size: 90,
        fill: '#CD853F',
        fillOpacity: 0,
        symbolType: brownPeople2
      }
    },
    {
      type: 'line',
      name: 'route',
      parent: 'pictogram',
      style: {
        points: points1
      }
    },
    {
      type: 'line',
      name: 'flippedRoute',
      parent: 'pictogram',
      style: {
        points: flippedPoints1
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'people',
      animation: true,
      style: {
        x: 40,
        y: 105,
        size: 90,
        fill: 'green',
        symbolType: whitePeople1
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'flippedPeople',
      animation: true,
      style: {
        x: 920,
        y: 105,
        size: 90,
        fill: 'red',
        fillOpacity: 0,
        symbolType: whitePeople2
      }
    },
    {
      type: 'line',
      name: 'route',
      parent: 'pictogram',
      style: {
        points: points2
      }
    },
    {
      type: 'line',
      name: 'flippedRoute',
      parent: 'pictogram',
      style: {
        points: flippedPoints2
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'people',
      animation: true,
      style: {
        x: 40,
        y: 187,
        size: 90,
        fill: 'yellow',
        symbolType: blackPeople2
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'flippedPeople',
      animation: true,
      style: {
        x: 920,
        y: 187,
        size: 90,
        fill: 'red',
        fillOpacity: 0,
        symbolType: blackPeople1
      }
    },
    {
      type: 'line',
      name: 'route',
      parent: 'pictogram',
      style: {
        points: points3
      }
    },
    {
      type: 'line',
      name: 'flippedRoute',
      parent: 'pictogram',
      style: {
        points: flippedPoints3
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'people',
      animation: true,
      style: {
        x: 40,
        y: 269,
        size: 90,
        fill: 'coral',
        symbolType: yellowPeople1
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'flippedPeople',
      animation: true,
      style: {
        x: 920,
        y: 269,
        size: 90,
        fill: 'red',
        fillOpacity: 0,
        symbolType: yellowPeople2
      }
    },
    {
      type: 'line',
      name: 'route',
      parent: 'pictogram',
      style: {
        points: points4
      }
    },
    {
      type: 'line',
      name: 'flippedRoute',
      parent: 'pictogram',
      style: {
        points: flippedPoints4
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'people',
      animation: true,
      style: {
        x: 40,
        y: 351,
        size: 90,
        fill: 'white',
        symbolType: tanPeople1
      }
    },
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'flippedPeople',
      animation: true,
      style: {
        x: 920,
        y: 351,
        size: 90,
        fill: 'red',
        fillOpacity: 0,
        symbolType: tanPeople2
      }
    },
    {
      type: 'line',
      name: 'route',
      parent: 'pictogram',
      style: {
        points: points5
      }
    },
    {
      type: 'line',
      name: 'flippedRoute',
      parent: 'pictogram',
      style: {
        points: flippedPoints5
      }
    }
  ],
  svg: 'route',
  nameField: 'name',
  valueField: 'value'
};

VChart.registerSVG('route', routeSVG);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
const chart = vchart.getChart();
const peopleGroup = chart?.getMarkByUserName('people');
const flippedPeopleGroup = chart?.getMarkByUserName('flippedPeople');
const routeGroup = chart?.getMarkByUserName('route');
const flippedRouteGroup = chart?.getMarkByUserName('flippedRoute');

// create forward routes
const cps = routeGroup.map(item => {
  const route = item?.getProduct()?.getGroupGraphicItem();
  const cp = new VRender.CustomPath2D();
  cp.fromLine(route);
  return cp;
});

// create backward routes
const flippedCps = flippedRouteGroup.map(item => {
  const route = item?.getProduct()?.getGroupGraphicItem();
  const flippedCp = new VRender.CustomPath2D();
  flippedCp.fromLine(route);
  return flippedCp;
});

// loop figures and create motion path animation
peopleGroup.forEach((peopleWrapper, index) => {
  const people = peopleWrapper?.getProduct()?.getGroupGraphicItem();
  const difference = 600 * index;
  const speed = index % 2 === 0 ? 10000 - difference : 10000 + difference;
  people
    .animate()
    .wait(2000)
    .play(
      new VRender.MotionPath(null, null, speed, 'easing', {
        path: cps[index],
        distance: 1,
        cb: () => {
          const difference = 500 * index;
          const speed = index % 3 === 0 ? 10000 - difference : 10000 + difference;
          const flippedPeople = flippedPeopleGroup[index].getProduct()?.getGroupGraphicItem();
          flippedPeople
            .animate()
            .to({ fillOpacity: 0 }, 500)
            .to({ fillOpacity: 1 }, 500)
            .play(
              new VRender.MotionPath(null, null, speed, 'linear', {
                path: flippedCps[index],
                distance: 1
              })
            );
        }
      })
    )
    .to({ fillOpacity: 0, strokeOpacity: 0 }, 500);
});
window['vchart'] = vchart;
```

## Related Tutorials

[PictogramChart](link)
