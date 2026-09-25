---
category: examples
group: pivot chart
title: Pivot Chart
keywords: pivotChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/preview/pivot-chart-scatter.png
link: '../guide/table_type/pivot_chart'
option: PivotChart-indicators-chart#cellType
---

# Pivot Chart

Guide: https://visactor.io/vtable/guide/table_type/pivot_chart.

The perspective combination diagram combines the vchart chart library to render into the table, enriching the visual display form and improving the rendering performance.

## Key Configurations

- `PivotChart` Initialize the table type using PivotChart.
- `VTable.register.chartModule('vchart', VChart)` Register a charting library for charting, currently supports VChart
- `cellType: 'chart'` Specify the type chart
- `chartModule: 'vchart'` Specify the registered chart library name
- `chartSpec: {}` Chart specs

## Code demo

```javascript livedemo template=vtable
VTable.register.chartModule('vchart', VChart);
let tableInstance;
function logScale(value, domain, range) {
  // 计算域和范围的对数
  const logDomain = domain.map(x => (x !== 0 ? Math.log10(x) : 0));
  const logRange = range.map(x => Math.log10(x));

  // 计算值在域内的位置，将其映射到范围内
  const t = (Math.log10(value) - logDomain[0]) / (logDomain[1] - logDomain[0]);
  const newValue = (logRange[1] - logRange[0]) * t + logRange[0];

  // 返回映射后的值，还原对数缩放
  return Math.pow(10, newValue);
}
const data = [
  {
    name: 'citroen ds-21 pallas',
    milesPerGallon: 0,
    cylinders: 4,
    horsepower: 115,
    origin_country: 'France'
  },
  {
    name: 'amc gremlin',
    milesPerGallon: 21,
    cylinders: 6,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet chevelle malibu',
    milesPerGallon: 18,
    cylinders: 8,
    horsepower: 130,
    origin_country: 'USA'
  },
  {
    name: 'buick skylark 320',
    milesPerGallon: 15,
    cylinders: 8,
    horsepower: 165,
    origin_country: 'USA'
  },
  {
    name: 'plymouth satellite',
    milesPerGallon: 18,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'amc rebel sst',
    milesPerGallon: 16,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'ford torino',
    milesPerGallon: 17,
    cylinders: 8,
    horsepower: 140,
    origin_country: 'USA'
  },
  {
    name: 'ford galaxie 500',
    milesPerGallon: 15,
    cylinders: 8,
    horsepower: 198,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet impala',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 220,
    origin_country: 'USA'
  },
  {
    name: 'plymouth fury iii',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 215,
    origin_country: 'USA'
  },
  {
    name: 'pontiac catalina',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 225,
    origin_country: 'USA'
  },
  {
    name: 'amc ambassador dpl',
    milesPerGallon: 15,
    cylinders: 8,
    horsepower: 190,
    origin_country: 'USA'
  },

  {
    name: 'chevrolet chevelle concours (sw)',
    milesPerGallon: 0,
    cylinders: 8,
    horsepower: 165,
    origin_country: 'USA'
  },
  {
    name: 'ford torino (sw)',
    milesPerGallon: 0,
    cylinders: 8,
    horsepower: 153,
    origin_country: 'USA'
  },
  {
    name: 'plymouth satellite (sw)',
    milesPerGallon: 0,
    cylinders: 8,
    horsepower: 175,
    origin_country: 'USA'
  },
  {
    name: 'amc rebel sst (sw)',
    milesPerGallon: 0,
    cylinders: 8,
    horsepower: 175,
    origin_country: 'USA'
  },
  {
    name: 'dodge challenger se',
    milesPerGallon: 15,
    cylinders: 8,
    horsepower: 170,
    origin_country: 'USA'
  },
  {
    name: "plymouth 'cuda 340",
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 160,
    origin_country: 'USA'
  },
  {
    name: 'ford mustang boss 302',
    milesPerGallon: 0,
    cylinders: 8,
    horsepower: 140,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet monte carlo',
    milesPerGallon: 15,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'buick estate wagon (sw)',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 225,
    origin_country: 'USA'
  },
  {
    name: 'toyota corona mark ii',
    milesPerGallon: 24,
    cylinders: 4,
    horsepower: 95,
    origin_country: 'Japan'
  },
  {
    name: 'plymouth duster',
    milesPerGallon: 22,
    cylinders: 6,
    horsepower: 95,
    origin_country: 'USA'
  },
  {
    name: 'amc hornet',
    milesPerGallon: 18,
    cylinders: 6,
    horsepower: 97,
    origin_country: 'USA'
  },
  {
    name: 'ford maverick',
    milesPerGallon: 21,
    cylinders: 6,
    horsepower: 85,
    origin_country: 'USA'
  },
  {
    name: 'datsun pl510',
    milesPerGallon: 27,
    cylinders: 4,
    horsepower: 88,
    origin_country: 'Japan'
  },
  {
    name: 'volkswagen 1131 deluxe sedan',
    milesPerGallon: 26,
    cylinders: 4,
    horsepower: 46,
    origin_country: 'Germany'
  },
  {
    name: 'peugeot 504',
    milesPerGallon: 25,
    cylinders: 4,
    horsepower: 87,
    origin_country: 'France'
  },
  {
    name: 'audi 100 ls',
    milesPerGallon: 24,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'Germany'
  },

  {
    name: 'bmw 2002',
    milesPerGallon: 26,
    cylinders: 4,
    horsepower: 113,
    origin_country: 'Germany'
  },

  {
    name: 'ford f250',
    milesPerGallon: 10,
    cylinders: 8,
    horsepower: 215,
    origin_country: 'USA'
  },
  {
    name: 'chevy c20',
    milesPerGallon: 10,
    cylinders: 8,
    horsepower: 200,
    origin_country: 'USA'
  },
  {
    name: 'dodge d200',
    milesPerGallon: 11,
    cylinders: 8,
    horsepower: 210,
    origin_country: 'USA'
  },
  {
    name: 'hi 1200d',
    milesPerGallon: 9,
    cylinders: 8,
    horsepower: 193,
    origin_country: 'USA'
  },
  {
    name: 'datsun pl510',
    milesPerGallon: 27,
    cylinders: 4,
    horsepower: 88,
    origin_country: 'Japan'
  },
  {
    name: 'chevrolet vega 2300',
    milesPerGallon: 28,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'toyota corona',
    milesPerGallon: 25,
    cylinders: 4,
    horsepower: 95,
    origin_country: 'Japan'
  },
  {
    name: 'ford pinto',
    milesPerGallon: 25,
    cylinders: 4,
    horsepower: 0,
    origin_country: 'USA'
  },
  {
    name: 'volkswagen super beetle 117',
    milesPerGallon: 0,
    cylinders: 4,
    horsepower: 48,
    origin_country: 'Germany'
  },
  {
    name: 'amc gremlin',
    milesPerGallon: 19,
    cylinders: 6,
    horsepower: 100,
    origin_country: 'USA'
  },
  {
    name: 'plymouth satellite custom',
    milesPerGallon: 16,
    cylinders: 6,
    horsepower: 105,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet chevelle malibu',
    milesPerGallon: 17,
    cylinders: 6,
    horsepower: 100,
    origin_country: 'USA'
  },
  {
    name: 'ford torino 500',
    milesPerGallon: 19,
    cylinders: 6,
    horsepower: 88,
    origin_country: 'USA'
  },
  {
    name: 'amc matador',
    milesPerGallon: 18,
    cylinders: 6,
    horsepower: 100,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet impala',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 165,
    origin_country: 'USA'
  },
  {
    name: 'pontiac catalina brougham',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 175,
    origin_country: 'USA'
  },
  {
    name: 'ford galaxie 500',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 153,
    origin_country: 'USA'
  },
  {
    name: 'plymouth fury iii',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'dodge monaco (sw)',
    milesPerGallon: 12,
    cylinders: 8,
    horsepower: 180,
    origin_country: 'USA'
  },
  {
    name: 'ford country squire (sw)',
    milesPerGallon: 13,
    cylinders: 8,
    horsepower: 170,
    origin_country: 'USA'
  },
  {
    name: 'pontiac safari (sw)',
    milesPerGallon: 13,
    cylinders: 8,
    horsepower: 175,
    origin_country: 'USA'
  },
  {
    name: 'amc hornet sportabout (sw)',
    milesPerGallon: 18,
    cylinders: 6,
    horsepower: 110,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet vega (sw)',
    milesPerGallon: 22,
    cylinders: 4,
    horsepower: 72,
    origin_country: 'USA'
  },
  {
    name: 'pontiac firebird',
    milesPerGallon: 19,
    cylinders: 6,
    horsepower: 100,
    origin_country: 'USA'
  },
  {
    name: 'ford mustang',
    milesPerGallon: 18,
    cylinders: 6,
    horsepower: 88,
    origin_country: 'USA'
  },
  {
    name: 'mercury capri 2000',
    milesPerGallon: 23,
    cylinders: 4,
    horsepower: 86,
    origin_country: 'USA'
  },
  {
    name: 'opel 1900',
    milesPerGallon: 28,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'Germany'
  },
  {
    name: 'peugeot 304',
    milesPerGallon: 30,
    cylinders: 4,
    horsepower: 70,
    origin_country: 'France'
  },
  {
    name: 'toyota corolla 1200',
    milesPerGallon: 31,
    cylinders: 4,
    horsepower: 65,
    origin_country: 'Japan'
  },
  {
    name: 'datsun 1200',
    milesPerGallon: 35,
    cylinders: 4,
    horsepower: 69,
    origin_country: 'Japan'
  },
  {
    name: 'volkswagen model 111',
    milesPerGallon: 27,
    cylinders: 4,
    horsepower: 60,
    origin_country: 'Germany'
  },
  {
    name: 'plymouth cricket',
    milesPerGallon: 26,
    cylinders: 4,
    horsepower: 70,
    origin_country: 'USA'
  },
  {
    name: 'toyota corona hardtop',
    milesPerGallon: 24,
    cylinders: 4,
    horsepower: 95,
    origin_country: 'Japan'
  },
  {
    name: 'dodge colt hardtop',
    milesPerGallon: 25,
    cylinders: 4,
    horsepower: 80,
    origin_country: 'USA'
  },
  {
    name: 'volkswagen type 3',
    milesPerGallon: 23,
    cylinders: 4,
    horsepower: 54,
    origin_country: 'Germany'
  },
  {
    name: 'chevrolet vega',
    milesPerGallon: 20,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'ford pinto runabout',
    milesPerGallon: 21,
    cylinders: 4,
    horsepower: 86,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet impala',
    milesPerGallon: 13,
    cylinders: 8,
    horsepower: 165,
    origin_country: 'USA'
  },
  {
    name: 'pontiac catalina',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 175,
    origin_country: 'USA'
  },
  {
    name: 'plymouth fury iii',
    milesPerGallon: 15,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'ford galaxie 500',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 153,
    origin_country: 'USA'
  },
  {
    name: 'amc ambassador sst',
    milesPerGallon: 17,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'mercury marquis',
    milesPerGallon: 11,
    cylinders: 8,
    horsepower: 208,
    origin_country: 'USA'
  },
  {
    name: 'buick lesabre custom',
    milesPerGallon: 13,
    cylinders: 8,
    horsepower: 155,
    origin_country: 'USA'
  },
  {
    name: 'oldsmobile delta 88 royale',
    milesPerGallon: 12,
    cylinders: 8,
    horsepower: 160,
    origin_country: 'USA'
  },
  {
    name: 'ford ltd',
    milesPerGallon: 13,
    cylinders: 8,
    horsepower: 158,
    origin_country: 'USA'
  },
  {
    name: 'plymouth fury gran sedan',
    milesPerGallon: 14,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'chrysler new yorker brougham',
    milesPerGallon: 13,
    cylinders: 8,
    horsepower: 215,
    origin_country: 'USA'
  },
  {
    name: 'buick electra 225 custom',
    milesPerGallon: 12,
    cylinders: 8,
    horsepower: 225,
    origin_country: 'USA'
  },
  {
    name: 'amc ambassador brougham',
    milesPerGallon: 13,
    cylinders: 8,
    horsepower: 175,
    origin_country: 'USA'
  },
  {
    name: 'plymouth valiant',
    milesPerGallon: 18,
    cylinders: 6,
    horsepower: 105,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet nova custom',
    milesPerGallon: 16,
    cylinders: 6,
    horsepower: 100,
    origin_country: 'USA'
  },
  {
    name: 'amc hornet',
    milesPerGallon: 18,
    cylinders: 6,
    horsepower: 100,
    origin_country: 'USA'
  },
  {
    name: 'ford maverick',
    milesPerGallon: 18,
    cylinders: 6,
    horsepower: 88,
    origin_country: 'USA'
  },
  {
    name: 'plymouth duster',
    milesPerGallon: 23,
    cylinders: 6,
    horsepower: 95,
    origin_country: 'USA'
  },
  {
    name: 'volkswagen super beetle',
    milesPerGallon: 26,
    cylinders: 4,
    horsepower: 46,
    origin_country: 'Germany'
  },
  // 这是最后一批数据
  {
    name: 'toyota corona',
    milesPerGallon: 25,
    cylinders: 4,
    horsepower: 95,
    origin_country: 'Japan'
  },
  {
    name: 'ford pinto',
    milesPerGallon: 25,
    cylinders: 4,
    horsepower: 0,
    origin_country: 'USA'
  },
  {
    name: 'datsun 810',
    milesPerGallon: 22,
    cylinders: 6,
    horsepower: 97,
    origin_country: 'Japan'
  },
  {
    name: 'bmw 320i',
    milesPerGallon: 21.5,
    cylinders: 4,
    horsepower: 110,
    origin_country: 'Germany'
  },
  {
    name: 'volkswagen rabbit custom diesel',
    milesPerGallon: 43.1,
    cylinders: 4,
    horsepower: 48,
    origin_country: 'Germany'
  },
  {
    name: 'ford fiesta',
    milesPerGallon: 36.1,
    cylinders: 4,
    horsepower: 66,
    origin_country: 'USA'
  },
  {
    name: 'mazda glc deluxe',
    milesPerGallon: 32.8,
    cylinders: 4,
    horsepower: 52,
    origin_country: 'Japan'
  },
  {
    name: 'datsun b210 gx',
    milesPerGallon: 39.4,
    cylinders: 4,
    horsepower: 70,
    origin_country: 'Japan'
  },
  {
    name: 'honda civic cvcc',
    milesPerGallon: 36.1,
    cylinders: 4,
    horsepower: 60,
    origin_country: 'Japan'
  },
  {
    name: 'oldsmobile cutlass salon brougham',
    milesPerGallon: 19.9,
    cylinders: 8,
    horsepower: 110,
    origin_country: 'USA'
  },
  {
    name: 'dodge diplomat',
    milesPerGallon: 19.4,
    cylinders: 8,
    horsepower: 140,
    origin_country: 'USA'
  },
  {
    name: 'mercury monarch ghia',
    milesPerGallon: 20.2,
    cylinders: 8,
    horsepower: 139,
    origin_country: 'USA'
  },
  {
    name: 'pontiac phoenix lj',
    milesPerGallon: 19.2,
    cylinders: 6,
    horsepower: 105,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet malibu',
    milesPerGallon: 20.5,
    cylinders: 6,
    horsepower: 95,
    origin_country: 'USA'
  },
  {
    name: 'ford fairmont (auto)',
    milesPerGallon: 20.2,
    cylinders: 6,
    horsepower: 85,
    origin_country: 'USA'
  },
  {
    name: 'ford fairmont (man)',
    milesPerGallon: 25.1,
    cylinders: 4,
    horsepower: 88,
    origin_country: 'USA'
  },
  {
    name: 'plymouth volare',
    milesPerGallon: 20.5,
    cylinders: 6,
    horsepower: 100,
    origin_country: 'USA'
  },
  {
    name: 'amc concord',
    milesPerGallon: 19.4,
    cylinders: 6,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'buick century special',
    milesPerGallon: 20.6,
    cylinders: 6,
    horsepower: 105,
    origin_country: 'USA'
  },
  {
    name: 'mercury zephyr',
    milesPerGallon: 20.8,
    cylinders: 6,
    horsepower: 85,
    origin_country: 'USA'
  },
  {
    name: 'dodge aspen',
    milesPerGallon: 18.6,
    cylinders: 6,
    horsepower: 110,
    origin_country: 'USA'
  },
  {
    name: 'amc concord d/l',
    milesPerGallon: 18.1,
    cylinders: 6,
    horsepower: 120,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet monte carlo landau',
    milesPerGallon: 19.2,
    cylinders: 8,
    horsepower: 145,
    origin_country: 'USA'
  },
  {
    name: 'buick regal sport coupe (turbo)',
    milesPerGallon: 17.7,
    cylinders: 6,
    horsepower: 165,
    origin_country: 'USA'
  },
  {
    name: 'ford futura',
    milesPerGallon: 18.1,
    cylinders: 8,
    horsepower: 139,
    origin_country: 'USA'
  },
  {
    name: 'dodge magnum xe',
    milesPerGallon: 17.5,
    cylinders: 8,
    horsepower: 140,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet chevette',
    milesPerGallon: 30,
    cylinders: 4,
    horsepower: 68,
    origin_country: 'USA'
  },
  {
    name: 'toyota corona',
    milesPerGallon: 27.5,
    cylinders: 4,
    horsepower: 95,
    origin_country: 'Japan'
  },
  {
    name: 'datsun 510',
    milesPerGallon: 27.2,
    cylinders: 4,
    horsepower: 97,
    origin_country: 'Japan'
  },
  {
    name: 'dodge omni',
    milesPerGallon: 30.9,
    cylinders: 4,
    horsepower: 75,
    origin_country: 'USA'
  },
  {
    name: 'toyota celica gt liftback',
    milesPerGallon: 21.1,
    cylinders: 4,
    horsepower: 95,
    origin_country: 'Japan'
  },
  {
    name: 'plymouth sapporo',
    milesPerGallon: 23.2,
    cylinders: 4,
    horsepower: 105,
    origin_country: 'USA'
  },
  {
    name: 'oldsmobile starfire sx',
    milesPerGallon: 23.8,
    cylinders: 4,
    horsepower: 85,
    origin_country: 'USA'
  },
  {
    name: 'datsun 200-sx',
    milesPerGallon: 23.9,
    cylinders: 4,
    horsepower: 97,
    origin_country: 'Japan'
  },

  {
    name: 'peugeot 604sl',
    milesPerGallon: 16.2,
    cylinders: 6,
    horsepower: 133,
    origin_country: 'France'
  },
  {
    name: 'volkswagen scirocco',
    milesPerGallon: 31.5,
    cylinders: 4,
    horsepower: 71,
    origin_country: 'Germany'
  },
  {
    name: 'honda Accelerationord lx',
    milesPerGallon: 29.5,
    cylinders: 4,
    horsepower: 68,
    origin_country: 'Japan'
  },
  {
    name: 'pontiac lemans v6',
    milesPerGallon: 21.5,
    cylinders: 6,
    horsepower: 115,
    origin_country: 'USA'
  },
  {
    name: 'mercury zephyr 6',
    milesPerGallon: 19.8,
    cylinders: 6,
    horsepower: 85,
    origin_country: 'USA'
  },
  {
    name: 'ford fairmont 4',
    milesPerGallon: 22.3,
    cylinders: 4,
    horsepower: 88,
    origin_country: 'USA'
  },
  {
    name: 'amc concord dl 6',
    milesPerGallon: 20.2,
    cylinders: 6,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'dodge aspen 6',
    milesPerGallon: 20.6,
    cylinders: 6,
    horsepower: 110,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet caprice classic',
    milesPerGallon: 17,
    cylinders: 8,
    horsepower: 130,
    origin_country: 'USA'
  },
  {
    name: 'ford ltd landau',
    milesPerGallon: 17.6,
    cylinders: 8,
    horsepower: 129,
    origin_country: 'USA'
  },
  {
    name: 'mercury grand marquis',
    milesPerGallon: 16.5,
    cylinders: 8,
    horsepower: 138,
    origin_country: 'USA'
  },
  {
    name: 'dodge st. regis',
    milesPerGallon: 18.2,
    cylinders: 8,
    horsepower: 135,
    origin_country: 'USA'
  },
  {
    name: 'buick estate wagon (sw)',
    milesPerGallon: 16.9,
    cylinders: 8,
    horsepower: 155,
    origin_country: 'USA'
  },
  {
    name: 'ford country squire (sw)',
    milesPerGallon: 15.5,
    cylinders: 8,
    horsepower: 142,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet malibu classic (sw)',
    milesPerGallon: 19.2,
    cylinders: 8,
    horsepower: 125,
    origin_country: 'USA'
  },
  {
    name: 'chrysler lebaron town @ country (sw)',
    milesPerGallon: 18.5,
    cylinders: 8,
    horsepower: 150,
    origin_country: 'USA'
  },
  {
    name: 'maxda glc deluxe',
    milesPerGallon: 34.1,
    cylinders: 4,
    horsepower: 65,
    origin_country: 'Japan'
  },
  {
    name: 'dodge colt hatchback custom',
    milesPerGallon: 35.7,
    cylinders: 4,
    horsepower: 80,
    origin_country: 'USA'
  },
  {
    name: 'amc spirit dl',
    milesPerGallon: 27.4,
    cylinders: 4,
    horsepower: 80,
    origin_country: 'USA'
  },
  {
    name: 'cadillac eldorado',
    milesPerGallon: 23,
    cylinders: 8,
    horsepower: 125,
    origin_country: 'USA'
  },
  {
    name: 'peugeot 504',
    milesPerGallon: 27.2,
    cylinders: 4,
    horsepower: 71,
    origin_country: 'France'
  },
  {
    name: 'oldsmobile cutlass salon brougham',
    milesPerGallon: 23.9,
    cylinders: 8,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'plymouth horizon',
    milesPerGallon: 34.2,
    cylinders: 4,
    horsepower: 70,
    origin_country: 'USA'
  },
  {
    name: 'plymouth horizon tc3',
    milesPerGallon: 34.5,
    cylinders: 4,
    horsepower: 70,
    origin_country: 'USA'
  },
  {
    name: 'datsun 210',
    milesPerGallon: 31.8,
    cylinders: 4,
    horsepower: 65,
    origin_country: 'Japan'
  },
  {
    name: 'buick skylark limited',
    milesPerGallon: 28.4,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'chevrolet citation',
    milesPerGallon: 28.8,
    cylinders: 6,
    horsepower: 115,
    origin_country: 'USA'
  },
  {
    name: 'oldsmobile omega brougham',
    milesPerGallon: 26.8,
    cylinders: 6,
    horsepower: 115,
    origin_country: 'USA'
  },
  {
    name: 'pontiac phoenix',
    milesPerGallon: 33.5,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'vw rabbit',
    milesPerGallon: 41.5,
    cylinders: 4,
    horsepower: 76,
    origin_country: 'Germany'
  },
  {
    name: 'toyota corolla tercel',
    milesPerGallon: 38.1,
    cylinders: 4,
    horsepower: 60,
    origin_country: 'Japan'
  },
  {
    name: 'chevrolet chevette',
    milesPerGallon: 32.1,
    cylinders: 4,
    horsepower: 70,
    origin_country: 'USA'
  },
  {
    name: 'datsun 310',
    milesPerGallon: 37.2,
    cylinders: 4,
    horsepower: 65,
    origin_country: 'Japan'
  },
  {
    name: 'chevrolet citation',
    milesPerGallon: 28,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'ford fairmont',
    milesPerGallon: 26.4,
    cylinders: 4,
    horsepower: 88,
    origin_country: 'USA'
  },
  {
    name: 'amc concord',
    milesPerGallon: 24.3,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'dodge aspen',
    milesPerGallon: 19.1,
    cylinders: 6,
    horsepower: 90,
    origin_country: 'USA'
  },
  {
    name: 'audi 4000',
    milesPerGallon: 34.3,
    cylinders: 4,
    horsepower: 78,
    origin_country: 'Germany'
  },
  {
    name: 'toyota corona liftback',
    milesPerGallon: 29.8,
    cylinders: 4,
    horsepower: 90,
    origin_country: 'Japan'
  },
  {
    name: 'mazda 626',
    milesPerGallon: 31.3,
    cylinders: 4,
    horsepower: 75,
    origin_country: 'Japan'
  },
  { name: 'vokswagen rabbit', milesPerGallon: 29.8, cylinders: 4, horsepower: 62, origin_country: 'Germany' },
  { name: 'datsun 280-zx', milesPerGallon: 32.7, cylinders: 6, horsepower: 132, origin_country: 'Japan' },

  { name: 'ford mustang cobra', milesPerGallon: 23.6, cylinders: 4, horsepower: 0, origin_country: 'USA' },
  { name: 'honda Accelerationord', milesPerGallon: 32.4, cylinders: 4, horsepower: 72, origin_country: 'Japan' },
  { name: 'plymouth reliant', milesPerGallon: 27.2, cylinders: 4, horsepower: 84, origin_country: 'USA' },
  { name: 'buick skylark', milesPerGallon: 26.6, cylinders: 4, horsepower: 84, origin_country: 'USA' },
  { name: 'dodge aries wagon (sw)', milesPerGallon: 25.8, cylinders: 4, horsepower: 92, origin_country: 'USA' },
  { name: 'chevrolet citation', milesPerGallon: 23.5, cylinders: 6, horsepower: 110, origin_country: 'USA' },
  { name: 'plymouth reliant', milesPerGallon: 30, cylinders: 4, horsepower: 84, origin_country: 'USA' },
  { name: 'toyota starlet', milesPerGallon: 39.1, cylinders: 4, horsepower: 58, origin_country: 'Japan' },
  { name: 'plymouth champ', milesPerGallon: 39, cylinders: 4, horsepower: 64, origin_country: 'USA' },
  { name: 'honda civic 1300', milesPerGallon: 35.1, cylinders: 4, horsepower: 60, origin_country: 'Japan' },
  { name: 'subaru', milesPerGallon: 32.3, cylinders: 4, horsepower: 67, origin_country: 'Japan' },
  { name: 'datsun 210', milesPerGallon: 37, cylinders: 4, horsepower: 65, origin_country: 'Japan' },
  { name: 'toyota tercel', milesPerGallon: 37.7, cylinders: 4, horsepower: 62, origin_country: 'Japan' },
  { name: 'honda prelude', milesPerGallon: 33.7, cylinders: 4, horsepower: 75, origin_country: 'Japan' },
  { name: 'toyota corolla', milesPerGallon: 32.4, cylinders: 4, horsepower: 75, origin_country: 'Japan' },
  { name: 'datsun 200sx', milesPerGallon: 32.9, cylinders: 4, horsepower: 100, origin_country: 'Japan' },
  { name: 'mazda 626', milesPerGallon: 31.6, cylinders: 4, horsepower: 74, origin_country: 'Japan' },
  { name: 'peugeot 505s turbo diesel', milesPerGallon: 28.1, cylinders: 4, horsepower: 80, origin_country: 'France' },

  { name: 'toyota cressida', milesPerGallon: 25.4, cylinders: 6, horsepower: 116, origin_country: 'Japan' },
  { name: 'datsun 810 maxima', milesPerGallon: 24.2, cylinders: 6, horsepower: 120, origin_country: 'Japan' },
  { name: 'buick century', milesPerGallon: 22.4, cylinders: 6, horsepower: 110, origin_country: 'USA' },
  { name: 'oldsmobile cutlass ls', milesPerGallon: 26.6, cylinders: 8, horsepower: 105, origin_country: 'USA' },
  { name: 'ford granada gl', milesPerGallon: 20.2, cylinders: 6, horsepower: 88, origin_country: 'USA' },
  { name: 'chrysler lebaron salon', milesPerGallon: 17.6, cylinders: 6, horsepower: 85, origin_country: 'USA' },
  { name: 'chevrolet cavalier', milesPerGallon: 28, cylinders: 4, horsepower: 88, origin_country: 'USA' },
  { name: 'chevrolet cavalier wagon', milesPerGallon: 27, cylinders: 4, horsepower: 88, origin_country: 'USA' },
  { name: 'chevrolet cavalier 2-door', milesPerGallon: 34, cylinders: 4, horsepower: 88, origin_country: 'USA' },
  { name: 'pontiac j2000 se hatchback', milesPerGallon: 31, cylinders: 4, horsepower: 85, origin_country: 'USA' },
  { name: 'dodge aries se', milesPerGallon: 29, cylinders: 4, horsepower: 84, origin_country: 'USA' },
  { name: 'pontiac phoenix', milesPerGallon: 27, cylinders: 4, horsepower: 90, origin_country: 'USA' },
  { name: 'ford fairmont futura', milesPerGallon: 24, cylinders: 4, horsepower: 92, origin_country: 'USA' },
  { name: 'amc concord dl', milesPerGallon: 23, cylinders: 4, horsepower: 0, origin_country: 'USA' },
  { name: 'volkswagen rabbit l', milesPerGallon: 36, cylinders: 4, horsepower: 74, origin_country: 'Germany' },
  { name: 'mazda glc custom l', milesPerGallon: 37, cylinders: 4, horsepower: 68, origin_country: 'Japan' },
  { name: 'mazda glc custom', milesPerGallon: 31, cylinders: 4, horsepower: 68, origin_country: 'Japan' },
  { name: 'plymouth horizon miser', milesPerGallon: 38, cylinders: 4, horsepower: 63, origin_country: 'USA' },
  { name: 'mercury lynx l', milesPerGallon: 36, cylinders: 4, horsepower: 70, origin_country: 'USA' },
  { name: 'nissan stanza xe', milesPerGallon: 36, cylinders: 4, horsepower: 88, origin_country: 'Japan' },
  { name: 'honda Accordion', milesPerGallon: 36, cylinders: 4, horsepower: 75, origin_country: 'Japan' },
  { name: 'toyota corolla', milesPerGallon: 34, cylinders: 4, horsepower: 70, origin_country: 'Japan' },
  { name: 'honda civic', milesPerGallon: 38, cylinders: 4, horsepower: 67, origin_country: 'Japan' },
  { name: 'honda civic (auto)', milesPerGallon: 32, cylinders: 4, horsepower: 67, origin_country: 'Japan' },
  { name: 'datsun 310 gx', milesPerGallon: 38, cylinders: 4, horsepower: 67, origin_country: 'Japan' },

  { name: 'buick century limited', milesPerGallon: 25, cylinders: 6, horsepower: 110, origin_country: 'USA' },
  {
    name: 'oldsmobile cutlass ciera (diesel)',
    milesPerGallon: 38,
    cylinders: 6,
    horsepower: 85,
    origin_country: 'USA'
  },
  { name: 'chrysler lebaron medallion', milesPerGallon: 26, cylinders: 4, horsepower: 92, origin_country: 'USA' },
  { name: 'ford granada l', milesPerGallon: 22, cylinders: 6, horsepower: 112, origin_country: 'USA' },
  { name: 'toyota celica gt', milesPerGallon: 32, cylinders: 4, horsepower: 96, origin_country: 'Japan' },
  { name: 'dodge charger 2.2', milesPerGallon: 36, cylinders: 4, horsepower: 84, origin_country: 'USA' },
  { name: 'chevrolet camaro', milesPerGallon: 27, cylinders: 4, horsepower: 90, origin_country: 'USA' },
  { name: 'ford mustang gl', milesPerGallon: 27, cylinders: 4, horsepower: 86, origin_country: 'USA' },
  { name: 'vw pickup', milesPerGallon: 44, cylinders: 4, horsepower: 52, origin_country: 'Germany' },
  { name: 'dodge rampage', milesPerGallon: 32, cylinders: 4, horsepower: 84, origin_country: 'USA' },
  { name: 'ford ranger', milesPerGallon: 28, cylinders: 4, horsepower: 79, origin_country: 'USA' },
  { name: 'chevy s-10', milesPerGallon: 31, cylinders: 4, horsepower: 82, origin_country: 'USA' }
];
const columns = [
  {
    dimensionKey: 'cylinders',
    title: 'cylinders',
    headerFormat(value) {
      return `${value} cylinders`;
    }
  }
];

const rows = [
  {
    dimensionKey: 'origin_country',
    title: 'origin_country'
  }
];

const indicators = [
  {
    indicatorKey: 'milesPerGallon',
    title: 'milesPerGallon',
    cellType: 'chart',
    chartModule: 'vchart',
    chartSpec: {
      type: 'scatter',
      xField: 'milesPerGallon',
      yField: 'horsepower',
      seriesField: 'origin_country',
      sizeField: 'milesPerGallon',
      size: d => logScale(d.milesPerGallon, [0, Math.max(...data.map(d => d.milesPerGallon))], [1, 20]),
      data: {
        id: 'baseData'
      },
      scales: [
        {
          id: 'color',
          type: 'ordinal',
          domain: ['USA', 'Germany', 'France', 'Japan'],
          range: ['#2E62F1', '#4DC36A', '#FF8406', 'pink']
        }
      ],
      tooltip: {
        dimension: {
          visible: true
        },
        mark: {
          title: true,
          content: [
            {
              key: d => d.name,
              value: d => d.y
            }
          ]
        }
      },
      crosshair: {
        yField: {
          visible: true,
          line: {
            visible: true,
            type: 'line'
          },
          label: {
            visible: true // label 默认关闭
          }
        },
        xField: {
          visible: true,
          line: {
            visible: true,
            type: 'line'
          },
          label: {
            visible: true // label 默认关闭
          }
        }
      },
      axes: [
        {
          title: {
            visible: true,
            text: 'Horse Power'
          },
          orient: 'left',
          range: { min: 0 },
          type: 'linear',
          innerOffset: {
            left: 6,
            right: 6,
            top: 6,
            bottom: 6
          }
        },
        {
          title: {
            visible: true,
            text: 'Miles Per Gallon'
          },
          orient: 'bottom',
          label: { visible: true },
          type: 'linear',
          innerOffset: {
            left: 6,
            right: 6,
            top: 6,
            bottom: 6
          }
        }
      ]
    },
    style: {
      padding: 1
    }
  }
];
const option = {
  rows: rows,
  columns: columns,
  indicators,
  records: data,
  defaultRowHeight: 200,
  defaultHeaderRowHeight: 50,
  defaultColWidth: 280,
  defaultHeaderColWidth: 100,
  indicatorTitle: '指标',
  autoWrapText: true,
  legends: {
    orient: 'bottom',
    type: 'discrete',
    data: [
      {
        label: 'USA',
        shape: {
          fill: '#2E62F1',
          symbolType: 'circle'
        }
      },
      {
        label: 'Germany',
        shape: {
          fill: '#4DC36A',
          symbolType: 'square'
        }
      },
      {
        label: 'France',
        shape: {
          fill: '#FF8406',
          symbolType: 'square'
        }
      },
      {
        label: 'Janpan',
        shape: {
          fill: 'pink',
          symbolType: 'square'
        }
      }
    ]
  },
  theme: {
    underlayBackgroundColor: 'rgba(255, 255, 255, 0)',
    defaultStyle: {
      fontSize: 14,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [0, 0, 0, 0],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    headerStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [0, 0, 1, 1],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    rowHeaderStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [1, 1, 0, 0],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    cornerHeaderStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [0, 1, 1, 0],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    cornerRightTopCellStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [0, 0, 1, 0],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    cornerLeftBottomCellStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [1, 1, 0, 0],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    cornerRightBottomCellStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [1, 0, 0, 0],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    rightFrozenStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [1, 0, 0, 1],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    bottomFrozenStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [1, 0, 0, 1],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    selectionStyle: {
      fontSize: 14,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [0, 0, 0, 0],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    bodyStyle: {
      fontSize: 12,
      fontFamily: '微软雅黑',
      fontWeight: '400',
      borderColor: '#CBCBCB',
      color: '#666666',
      bgColor: '#FFFFFF',
      borderLineWidth: [1, 0, 1, 1],
      frameStyle: {
        borderLineWidth: 0,
        borderColor: '#CBCBCB'
      },
      cellBgColor: '',
      cellBorderColor: ''
    },
    frameStyle: {
      borderLineWidth: 0,
      borderColor: '#CBCBCB'
    }
  }
};
tableInstance = new VTable.PivotChart(document.getElementById(CONTAINER_ID), option);
const { LEGEND_ITEM_CLICK } = VTable.ListTable.EVENT_TYPE;
tableInstance.on(LEGEND_ITEM_CLICK, args => {
  console.log('LEGEND_ITEM_CLICK', args);
  tableInstance.updateFilterRules([
    {
      filterKey: 'origin_country',
      filteredValues: args.value
    }
  ]);
});
window.tableInstance = tableInstance;
```
