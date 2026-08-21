---
category: demo
group: data-zoom
title: Thumbnail Axis Controls Polar Chart
keywords: polarChart,dataZoom
order: 29-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data-zoom/data-zoom-polar.png
option: radarChart#dataZoom
---

# Thumbnail Axis Controls Polar Chart

Generally speaking, the thumbnail axis component follows the Cartesian coordinate axis for axis scaling to update the chart elements. In VChart, the thumbnail axis component performs related data filtering to trigger axis updates, thus achieving the effect of controlling any coordinate axis.

## Key option

- The `orient` attribute declares the position of the thumbnail axis component relative to the chart; `bottom` is at the bottom of the chart, `top` is at the top of the chart, `left` is at the left side of the chart, `right` is at the right side of the chart.
- The `filterMode` attribute declares the scaling method of the thumbnail axis component; `filter` is to filter data to achieve axis scaling effect, `axis` is to scale the axis directly without filtering data.

## Live Demo

```javascript livedemo
const spec = {
  type: 'radar',
  categoryField: 'axis',
  valueField: 'value',
  seriesField: 'type',
  startAngle: 0,
  stack: true,
  point: {
    visible: false
  },
  axes: [
    {
      orient: 'angle',
      domain: { visible: true },
      label: {
        formatMethod: v => `#${v}`
      }
    },
    {
      orient: 'radius',
      grid: { visible: true }
    }
  ],
  dataZoom: [
    {
      orient: 'bottom',
      filterMode: 'filter'
    }
  ],
  point: {
    style: {
      visible: false
    }
  },
  title: {
    text: 'This example contains an extendable radar chart that represents the percentage fields of the Kaggle Candies regression data set',
    padding: {
      bottom: 20
    },
    textStyle: {
      height: 50,
      lineWidth: 2,
      fill: '#333',
      fontSize: 20,
      fontFamily: 'Times New Roman'
    },
    subtextStyle: {
      character: [
        {
          text: '- sugarpercent: The percentile of sugar it falls under within the data set.\n- pricepercent: The unit price percentile compared to the rest of the set.\n- winpercent: The overall win percentage according to 269,000 matchups.',
          fontFamily: 'Times New Roman',
          fontSize: 14,
          fill: '#333'
        }
      ]
    }
  },
  data: [
    {
      id: 'data',
      values: [
        {
          axis: '100 Grand',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: '3 Musketeers',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'One dime',
          value: 0.011,
          type: 'sugarpercent'
        },
        {
          axis: 'One quarter',
          value: 0.011,
          type: 'sugarpercent'
        },
        {
          axis: 'Air Heads',
          value: 0.90600002,
          type: 'sugarpercent'
        },
        {
          axis: 'Almond Joy',
          value: 0.465,
          type: 'sugarpercent'
        },
        {
          axis: 'Baby Ruth',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Boston Baked Beans',
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Candy Corn',
          value: 0.90600002,
          type: 'sugarpercent'
        },
        {
          axis: 'Caramel Apple Pops',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Charleston Chew',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Chewey Lemonhead Fruit Mix',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Chiclets',
          value: 0.046,
          type: 'sugarpercent'
        },
        {
          axis: 'Dots',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Dum Dums',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Fruit Chews',
          value: 0.127,
          type: 'sugarpercent'
        },
        {
          axis: 'Fun Dip',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Gobstopper',
          value: 0.90600002,
          type: 'sugarpercent'
        },
        {
          axis: 'Haribo Gold Bears',
          value: 0.465,
          type: 'sugarpercent'
        },
        {
          axis: 'Haribo Happy Cola',
          value: 0.465,
          type: 'sugarpercent'
        },
        {
          axis: 'Haribo Sour Bears',
          value: 0.465,
          type: 'sugarpercent'
        },
        {
          axis: 'Haribo Twin Snakes',
          value: 0.465,
          type: 'sugarpercent'
        },
        {
          axis: "Hershey's Kisses",
          value: 0.127,
          type: 'sugarpercent'
        },
        {
          axis: "Hershey's Krackel",
          value: 0.43000001,
          type: 'sugarpercent'
        },
        {
          axis: "Hershey's Milk Chocolate",
          value: 0.43000001,
          type: 'sugarpercent'
        },
        {
          axis: "Hershey's Special Dark",
          value: 0.43000001,
          type: 'sugarpercent'
        },
        {
          axis: 'Jawbusters',
          value: 0.093000002,
          type: 'sugarpercent'
        },
        {
          axis: 'Junior Mints',
          value: 0.197,
          type: 'sugarpercent'
        },
        {
          axis: 'Kit Kat',
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Laffy Taffy',
          value: 0.22,
          type: 'sugarpercent'
        },
        {
          axis: 'Lemonhead',
          value: 0.046,
          type: 'sugarpercent'
        },
        {
          axis: 'Lifesavers big ring gummies',
          value: 0.26699999,
          type: 'sugarpercent'
        },
        {
          axis: "Peanut butter M&M's",
          value: 0.82499999,
          type: 'sugarpercent'
        },
        {
          axis: "M&M's",
          value: 0.82499999,
          type: 'sugarpercent'
        },
        {
          axis: 'Mike & Ike',
          value: 0.87199998,
          type: 'sugarpercent'
        },
        {
          axis: 'Milk Duds',
          value: 0.30199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Milky Way',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Milky Way Midnight',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Milky Way Simply Caramel',
          value: 0.96499997,
          type: 'sugarpercent'
        },
        {
          axis: 'Mounds',
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Mr Good Bar',
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Nerds',
          value: 0.84799999,
          type: 'sugarpercent'
        },
        {
          axis: 'Nestle Butterfinger',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Nestle Crunch',
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Nik L Nip',
          value: 0.197,
          type: 'sugarpercent'
        },
        {
          axis: 'Now & Later',
          value: 0.22,
          type: 'sugarpercent'
        },
        {
          axis: 'Payday',
          value: 0.465,
          type: 'sugarpercent'
        },
        {
          axis: 'Peanut M&Ms',
          value: 0.59299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Pixie Sticks',
          value: 0.093000002,
          type: 'sugarpercent'
        },
        {
          axis: 'Pop Rocks',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Red vines',
          value: 0.58099997,
          type: 'sugarpercent'
        },
        {
          axis: "Reese's Miniatures",
          value: 0.034000002,
          type: 'sugarpercent'
        },
        {
          axis: "Reese's Peanut Butter cup",
          value: 0.72000003,
          type: 'sugarpercent'
        },
        {
          axis: "Reese's pieces",
          value: 0.40599999,
          type: 'sugarpercent'
        },
        {
          axis: "Reese's stuffed with pieces",
          value: 0.98799998,
          type: 'sugarpercent'
        },
        {
          axis: 'Ring pop',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Rolo',
          value: 0.86000001,
          type: 'sugarpercent'
        },
        {
          axis: 'Root Beer Barrels',
          value: 0.73199999,
          type: 'sugarpercent'
        },
        {
          axis: 'Runts',
          value: 0.87199998,
          type: 'sugarpercent'
        },
        {
          axis: 'Sixlets',
          value: 0.22,
          type: 'sugarpercent'
        },
        {
          axis: 'Skittles original',
          value: 0.94099998,
          type: 'sugarpercent'
        },
        {
          axis: 'Skittles wildberry',
          value: 0.94099998,
          type: 'sugarpercent'
        },
        {
          axis: 'Nestle Smarties',
          value: 0.26699999,
          type: 'sugarpercent'
        },
        {
          axis: 'Smarties candy',
          value: 0.26699999,
          type: 'sugarpercent'
        },
        {
          axis: 'Snickers',
          value: 0.546,
          type: 'sugarpercent'
        },
        {
          axis: 'Snickers Crisper',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Sour Patch Kids',
          value: 0.068999998,
          type: 'sugarpercent'
        },
        {
          axis: 'Sour Patch Tricksters',
          value: 0.068999998,
          type: 'sugarpercent'
        },
        {
          axis: 'Starburst',
          value: 0.15099999,
          type: 'sugarpercent'
        },
        {
          axis: 'Strawberry bon bons',
          value: 0.56900001,
          type: 'sugarpercent'
        },
        {
          axis: 'Sugar Babies',
          value: 0.96499997,
          type: 'sugarpercent'
        },
        {
          axis: 'Sugar Daddy',
          value: 0.41800001,
          type: 'sugarpercent'
        },
        {
          axis: 'Super Bubble',
          value: 0.162,
          type: 'sugarpercent'
        },
        {
          axis: 'Swedish Fish',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Tootsie Pop',
          value: 0.60399997,
          type: 'sugarpercent'
        },
        {
          axis: 'Tootsie Roll Juniors',
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Tootsie Roll Midgies',
          value: 0.17399999,
          type: 'sugarpercent'
        },
        {
          axis: 'Tootsie Roll Snack Bars',
          value: 0.465,
          type: 'sugarpercent'
        },
        {
          axis: 'Trolli Sour Bites',
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: 'Twix',
          value: 0.546,
          type: 'sugarpercent'
        },
        {
          axis: 'Twizzlers',
          value: 0.22,
          type: 'sugarpercent'
        },
        {
          axis: 'Warheads',
          value: 0.093000002,
          type: 'sugarpercent'
        },
        {
          axis: "Welch's Fruit Snacks",
          value: 0.31299999,
          type: 'sugarpercent'
        },
        {
          axis: "Werther's Original Caramel",
          value: 0.186,
          type: 'sugarpercent'
        },
        {
          axis: 'Whoppers',
          value: 0.87199998,
          type: 'sugarpercent'
        },
        {
          axis: '100 Grand',
          value: 0.86000001,
          type: 'pricepercent'
        },
        {
          axis: '3 Musketeers',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'One dime',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: 'One quarter',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Air Heads',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Almond Joy',
          value: 0.76700002,
          type: 'pricepercent'
        },
        {
          axis: 'Baby Ruth',
          value: 0.76700002,
          type: 'pricepercent'
        },
        {
          axis: 'Boston Baked Beans',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Candy Corn',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Caramel Apple Pops',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Charleston Chew',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Chewey Lemonhead Fruit Mix',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Chiclets',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Dots',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Dum Dums',
          value: 0.034000002,
          type: 'pricepercent'
        },
        {
          axis: 'Fruit Chews',
          value: 0.034000002,
          type: 'pricepercent'
        },
        {
          axis: 'Fun Dip',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Gobstopper',
          value: 0.45300001,
          type: 'pricepercent'
        },
        {
          axis: 'Haribo Gold Bears',
          value: 0.465,
          type: 'pricepercent'
        },
        {
          axis: 'Haribo Happy Cola',
          value: 0.465,
          type: 'pricepercent'
        },
        {
          axis: 'Haribo Sour Bears',
          value: 0.465,
          type: 'pricepercent'
        },
        {
          axis: 'Haribo Twin Snakes',
          value: 0.465,
          type: 'pricepercent'
        },
        {
          axis: "Hershey's Kisses",
          value: 0.093000002,
          type: 'pricepercent'
        },
        {
          axis: "Hershey's Krackel",
          value: 0.91799998,
          type: 'pricepercent'
        },
        {
          axis: "Hershey's Milk Chocolate",
          value: 0.91799998,
          type: 'pricepercent'
        },
        {
          axis: "Hershey's Special Dark",
          value: 0.91799998,
          type: 'pricepercent'
        },
        {
          axis: 'Jawbusters',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Junior Mints',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Kit Kat',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Laffy Taffy',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: 'Lemonhead',
          value: 0.104,
          type: 'pricepercent'
        },
        {
          axis: 'Lifesavers big ring gummies',
          value: 0.27900001,
          type: 'pricepercent'
        },
        {
          axis: "Peanut butter M&M's",
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: "M&M's",
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: 'Mike & Ike',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Milk Duds',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Milky Way',
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: 'Milky Way Midnight',
          value: 0.44100001,
          type: 'pricepercent'
        },
        {
          axis: 'Milky Way Simply Caramel',
          value: 0.86000001,
          type: 'pricepercent'
        },
        {
          axis: 'Mounds',
          value: 0.86000001,
          type: 'pricepercent'
        },
        {
          axis: 'Mr Good Bar',
          value: 0.91799998,
          type: 'pricepercent'
        },
        {
          axis: 'Nerds',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Nestle Butterfinger',
          value: 0.76700002,
          type: 'pricepercent'
        },
        {
          axis: 'Nestle Crunch',
          value: 0.76700002,
          type: 'pricepercent'
        },
        {
          axis: 'Nik L Nip',
          value: 0.97600001,
          type: 'pricepercent'
        },
        {
          axis: 'Now & Later',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Payday',
          value: 0.76700002,
          type: 'pricepercent'
        },
        {
          axis: 'Peanut M&Ms',
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: 'Pixie Sticks',
          value: 0.023,
          type: 'pricepercent'
        },
        {
          axis: 'Pop Rocks',
          value: 0.83700001,
          type: 'pricepercent'
        },
        {
          axis: 'Red vines',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: "Reese's Miniatures",
          value: 0.27900001,
          type: 'pricepercent'
        },
        {
          axis: "Reese's Peanut Butter cup",
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: "Reese's pieces",
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: "Reese's stuffed with pieces",
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: 'Ring pop',
          value: 0.96499997,
          type: 'pricepercent'
        },
        {
          axis: 'Rolo',
          value: 0.86000001,
          type: 'pricepercent'
        },
        {
          axis: 'Root Beer Barrels',
          value: 0.068999998,
          type: 'pricepercent'
        },
        {
          axis: 'Runts',
          value: 0.27900001,
          type: 'pricepercent'
        },
        {
          axis: 'Sixlets',
          value: 0.081,
          type: 'pricepercent'
        },
        {
          axis: 'Skittles original',
          value: 0.22,
          type: 'pricepercent'
        },
        {
          axis: 'Skittles wildberry',
          value: 0.22,
          type: 'pricepercent'
        },
        {
          axis: 'Nestle Smarties',
          value: 0.97600001,
          type: 'pricepercent'
        },
        {
          axis: 'Smarties candy',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: 'Snickers',
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: 'Snickers Crisper',
          value: 0.65100002,
          type: 'pricepercent'
        },
        {
          axis: 'Sour Patch Kids',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: 'Sour Patch Tricksters',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: 'Starburst',
          value: 0.22,
          type: 'pricepercent'
        },
        {
          axis: 'Strawberry bon bons',
          value: 0.057999998,
          type: 'pricepercent'
        },
        {
          axis: 'Sugar Babies',
          value: 0.76700002,
          type: 'pricepercent'
        },
        {
          axis: 'Sugar Daddy',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Super Bubble',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: 'Swedish Fish',
          value: 0.755,
          type: 'pricepercent'
        },
        {
          axis: 'Tootsie Pop',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Tootsie Roll Juniors',
          value: 0.51099998,
          type: 'pricepercent'
        },
        {
          axis: 'Tootsie Roll Midgies',
          value: 0.011,
          type: 'pricepercent'
        },
        {
          axis: 'Tootsie Roll Snack Bars',
          value: 0.32499999,
          type: 'pricepercent'
        },
        {
          axis: 'Trolli Sour Bites',
          value: 0.255,
          type: 'pricepercent'
        },
        {
          axis: 'Twix',
          value: 0.90600002,
          type: 'pricepercent'
        },
        {
          axis: 'Twizzlers',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: 'Warheads',
          value: 0.116,
          type: 'pricepercent'
        },
        {
          axis: "Welch's Fruit Snacks",
          value: 0.31299999,
          type: 'pricepercent'
        },
        {
          axis: "Werther's Original Caramel",
          value: 0.26699999,
          type: 'pricepercent'
        },
        {
          axis: 'Whoppers',
          value: 0.84799999,
          type: 'pricepercent'
        },
        {
          axis: '100 Grand',
          value: 0.66971725,
          type: 'winpercent'
        },
        {
          axis: '3 Musketeers',
          value: 0.67602936,
          type: 'winpercent'
        },
        {
          axis: 'One dime',
          value: 0.32261086,
          type: 'winpercent'
        },
        {
          axis: 'One quarter',
          value: 0.46116504999999997,
          type: 'winpercent'
        },
        {
          axis: 'Air Heads',
          value: 0.52341465,
          type: 'winpercent'
        },
        {
          axis: 'Almond Joy',
          value: 0.50347546,
          type: 'winpercent'
        },
        {
          axis: 'Baby Ruth',
          value: 0.56914547,
          type: 'winpercent'
        },
        {
          axis: 'Boston Baked Beans',
          value: 0.23417823999999998,
          type: 'winpercent'
        },
        {
          axis: 'Candy Corn',
          value: 0.38010963,
          type: 'winpercent'
        },
        {
          axis: 'Caramel Apple Pops',
          value: 0.34517681000000006,
          type: 'winpercent'
        },
        {
          axis: 'Charleston Chew',
          value: 0.38975037,
          type: 'winpercent'
        },
        {
          axis: 'Chewey Lemonhead Fruit Mix',
          value: 0.36017628,
          type: 'winpercent'
        },
        {
          axis: 'Chiclets',
          value: 0.24524988,
          type: 'winpercent'
        },
        {
          axis: 'Dots',
          value: 0.42272076,
          type: 'winpercent'
        },
        {
          axis: 'Dum Dums',
          value: 0.39460555999999997,
          type: 'winpercent'
        },
        {
          axis: 'Fruit Chews',
          value: 0.43088924,
          type: 'winpercent'
        },
        {
          axis: 'Fun Dip',
          value: 0.39185505,
          type: 'winpercent'
        },
        {
          axis: 'Gobstopper',
          value: 0.46783347999999997,
          type: 'winpercent'
        },
        {
          axis: 'Haribo Gold Bears',
          value: 0.5711974,
          type: 'winpercent'
        },
        {
          axis: 'Haribo Happy Cola',
          value: 0.34158958,
          type: 'winpercent'
        },
        {
          axis: 'Haribo Sour Bears',
          value: 0.5141243,
          type: 'winpercent'
        },
        {
          axis: 'Haribo Twin Snakes',
          value: 0.42178772000000003,
          type: 'winpercent'
        },
        {
          axis: "Hershey's Kisses",
          value: 0.55375454,
          type: 'winpercent'
        },
        {
          axis: "Hershey's Krackel",
          value: 0.62284481,
          type: 'winpercent'
        },
        {
          axis: "Hershey's Milk Chocolate",
          value: 0.56490501,
          type: 'winpercent'
        },
        {
          axis: "Hershey's Special Dark",
          value: 0.59236122,
          type: 'winpercent'
        },
        {
          axis: 'Jawbusters',
          value: 0.28127439,
          type: 'winpercent'
        },
        {
          axis: 'Junior Mints',
          value: 0.5721925,
          type: 'winpercent'
        },
        {
          axis: 'Kit Kat',
          value: 0.7676860000000001,
          type: 'winpercent'
        },
        {
          axis: 'Laffy Taffy',
          value: 0.41389557000000005,
          type: 'winpercent'
        },
        {
          axis: 'Lemonhead',
          value: 0.39141055999999996,
          type: 'winpercent'
        },
        {
          axis: 'Lifesavers big ring gummies',
          value: 0.52911392,
          type: 'winpercent'
        },
        {
          axis: "Peanut butter M&M's",
          value: 0.7146505000000001,
          type: 'winpercent'
        },
        {
          axis: "M&M's",
          value: 0.66574585,
          type: 'winpercent'
        },
        {
          axis: 'Mike & Ike',
          value: 0.46411716,
          type: 'winpercent'
        },
        {
          axis: 'Milk Duds',
          value: 0.5506407200000001,
          type: 'winpercent'
        },
        {
          axis: 'Milky Way',
          value: 0.7309955600000001,
          type: 'winpercent'
        },
        {
          axis: 'Milky Way Midnight',
          value: 0.60800701,
          type: 'winpercent'
        },
        {
          axis: 'Milky Way Simply Caramel',
          value: 0.6435334,
          type: 'winpercent'
        },
        {
          axis: 'Mounds',
          value: 0.47829754,
          type: 'winpercent'
        },
        {
          axis: 'Mr Good Bar',
          value: 0.54526451,
          type: 'winpercent'
        },
        {
          axis: 'Nerds',
          value: 0.55354046,
          type: 'winpercent'
        },
        {
          axis: 'Nestle Butterfinger',
          value: 0.70735641,
          type: 'winpercent'
        },
        {
          axis: 'Nestle Crunch',
          value: 0.6647068,
          type: 'winpercent'
        },
        {
          axis: 'Nik L Nip',
          value: 0.22445341,
          type: 'winpercent'
        },
        {
          axis: 'Now & Later',
          value: 0.39446800000000004,
          type: 'winpercent'
        },
        {
          axis: 'Payday',
          value: 0.46296597,
          type: 'winpercent'
        },
        {
          axis: 'Peanut M&Ms',
          value: 0.69483788,
          type: 'winpercent'
        },
        {
          axis: 'Pixie Sticks',
          value: 0.37722336,
          type: 'winpercent'
        },
        {
          axis: 'Pop Rocks',
          value: 0.41265511,
          type: 'winpercent'
        },
        {
          axis: 'Red vines',
          value: 0.37348522,
          type: 'winpercent'
        },
        {
          axis: "Reese's Miniatures",
          value: 0.8186625700000001,
          type: 'winpercent'
        },
        {
          axis: "Reese's Peanut Butter cup",
          value: 0.8418029,
          type: 'winpercent'
        },
        {
          axis: "Reese's pieces",
          value: 0.7343499,
          type: 'winpercent'
        },
        {
          axis: "Reese's stuffed with pieces",
          value: 0.72887901,
          type: 'winpercent'
        },
        {
          axis: 'Ring pop',
          value: 0.35290756,
          type: 'winpercent'
        },
        {
          axis: 'Rolo',
          value: 0.65716286,
          type: 'winpercent'
        },
        {
          axis: 'Root Beer Barrels',
          value: 0.29703691,
          type: 'winpercent'
        },
        {
          axis: 'Runts',
          value: 0.42849144,
          type: 'winpercent'
        },
        {
          axis: 'Sixlets',
          value: 0.34722000000000003,
          type: 'winpercent'
        },
        {
          axis: 'Skittles original',
          value: 0.6308514000000001,
          type: 'winpercent'
        },
        {
          axis: 'Skittles wildberry',
          value: 0.55103695,
          type: 'winpercent'
        },
        {
          axis: 'Nestle Smarties',
          value: 0.37887188,
          type: 'winpercent'
        },
        {
          axis: 'Smarties candy',
          value: 0.45995827,
          type: 'winpercent'
        },
        {
          axis: 'Snickers',
          value: 0.76673782,
          type: 'winpercent'
        },
        {
          axis: 'Snickers Crisper',
          value: 0.59529251,
          type: 'winpercent'
        },
        {
          axis: 'Sour Patch Kids',
          value: 0.5986399800000001,
          type: 'winpercent'
        },
        {
          axis: 'Sour Patch Tricksters',
          value: 0.52825947,
          type: 'winpercent'
        },
        {
          axis: 'Starburst',
          value: 0.6703762799999999,
          type: 'winpercent'
        },
        {
          axis: 'Strawberry bon bons',
          value: 0.34578991000000003,
          type: 'winpercent'
        },
        {
          axis: 'Sugar Babies',
          value: 0.3343755,
          type: 'winpercent'
        },
        {
          axis: 'Sugar Daddy',
          value: 0.32230995,
          type: 'winpercent'
        },
        {
          axis: 'Super Bubble',
          value: 0.27303865,
          type: 'winpercent'
        },
        {
          axis: 'Swedish Fish',
          value: 0.54861111,
          type: 'winpercent'
        },
        {
          axis: 'Tootsie Pop',
          value: 0.48982651,
          type: 'winpercent'
        },
        {
          axis: 'Tootsie Roll Juniors',
          value: 0.43068897,
          type: 'winpercent'
        },
        {
          axis: 'Tootsie Roll Midgies',
          value: 0.45736748,
          type: 'winpercent'
        },
        {
          axis: 'Tootsie Roll Snack Bars',
          value: 0.49653503,
          type: 'winpercent'
        },
        {
          axis: 'Trolli Sour Bites',
          value: 0.47173229,
          type: 'winpercent'
        },
        {
          axis: 'Twix',
          value: 0.81642914,
          type: 'winpercent'
        },
        {
          axis: 'Twizzlers',
          value: 0.45466282,
          type: 'winpercent'
        },
        {
          axis: 'Warheads',
          value: 0.39011898,
          type: 'winpercent'
        },
        {
          axis: "Welch's Fruit Snacks",
          value: 0.44375518999999997,
          type: 'winpercent'
        },
        {
          axis: "Werther's Original Caramel",
          value: 0.41904308,
          type: 'winpercent'
        },
        {
          axis: 'Whoppers',
          value: 0.49524113,
          type: 'winpercent'
        }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach a link to the tutorial or api documentation related to this demo configuration.
