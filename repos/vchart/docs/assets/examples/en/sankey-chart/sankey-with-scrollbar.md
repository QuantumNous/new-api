---
category: examples
group: sankey chart
title: 带滚动条的桑基图
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-2
cover: /vchart/preview/sankey-scrollbar-1.13.0.jpeg
option: sankeyChart
---

# Sankey Chart with Scrollbar

When there are too many nodes, you can set `overflow` to `scroll` to display a scrollbar.

## Key Configuration

- `linkWidth` specifies the width of the links
- `overflow` set to `scroll` allows scrolling when there are too many nodes

## Code Demonstration

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      values: [
        {
          links: [
            { source: 'Agricultural Energy Use', target: 'Carbon Dioxide', value: '1.4' },
            { source: 'Agriculture', target: 'Agriculture Soils', value: '5.2' },
            { source: 'Agriculture', target: 'Livestock and Manure', value: '5.4' },
            { source: 'Agriculture', target: 'Other Agriculture', value: '1.7' },
            { source: 'Agriculture', target: 'Rice Cultivation', value: '1.5' },
            { source: 'Agriculture Soils', target: 'Nitrous Oxide', value: '5.2' },
            { source: 'Air', target: 'Carbon Dioxide', value: '1.7' },
            { source: 'Aluminium Non-Ferrous Metals', target: 'Carbon Dioxide', value: '1.0' },
            { source: 'Aluminium Non-Ferrous Metals', target: 'HFCs - PFCs', value: '0.2' },
            { source: 'Cement', target: 'Carbon Dioxide', value: '5.0' },
            { source: 'Chemicals', target: 'Carbon Dioxide', value: '3.4' },
            { source: 'Chemicals', target: 'HFCs - PFCs', value: '0.5' },
            { source: 'Chemicals', target: 'Nitrous Oxide', value: '0.2' },
            { source: 'Coal Mining', target: 'Carbon Dioxide', value: '0.1' },
            { source: 'Coal Mining', target: 'Methane', value: '1.2' },
            { source: 'Commercial Buildings', target: 'Carbon Dioxide', value: '6.3' },
            { source: 'Deforestation', target: 'Carbon Dioxide', value: '10.9' },
            { source: 'Electricity and heat', target: 'Agricultural Energy Use', value: '0.4' },
            { source: 'Electricity and heat', target: 'Aluminium Non-Ferrous Metals', value: '0.4' },
            { source: 'Electricity and heat', target: 'Cement', value: '0.3' },
            { source: 'Electricity and heat', target: 'Chemicals', value: '1.3' },
            { source: 'Electricity and heat', target: 'Commercial Buildings', value: '5.0' },
            { source: 'Electricity and heat', target: 'Food and Tobacco', value: '0.5' },
            { source: 'Electricity and heat', target: 'Iron and Steel', value: '1.0' },
            { source: 'Electricity and heat', target: 'Machinery', value: '1.0' },
            { source: 'Electricity and heat', target: 'Oil and Gas Processing', value: '0.4' },
            { source: 'Electricity and heat', target: 'Other Industry', value: '2.7' },
            { source: 'Electricity and heat', target: 'Pulp - Paper and Printing', value: '0.6' },
            { source: 'Electricity and heat', target: 'Residential Buildings', value: '5.2' },
            { source: 'Electricity and heat', target: 'T and D Losses', value: '2.2' },
            { source: 'Electricity and heat', target: 'Unallocated Fuel Combustion', value: '2.0' },
            { source: 'Energy', target: 'Electricity and heat', value: '24.9' },
            { source: 'Energy', target: 'Fugitive Emissions', value: '4.0' },
            { source: 'Energy', target: 'Industry', value: '14.7' },
            { source: 'Energy', target: 'Other Fuel Combustion', value: '8.6' },
            { source: 'Energy', target: 'Transportation', value: '14.3' },
            { source: 'Food and Tobacco', target: 'Carbon Dioxide', value: '1.0' },
            { source: 'Fugitive Emissions', target: 'Coal Mining', value: '1.3' },
            { source: 'Fugitive Emissions', target: 'Oil and Gas Processing', value: '3.2' },
            { source: 'Harvest / Management', target: 'Carbon Dioxide', value: '1.3' },
            { source: 'Industrial Processes', target: 'Aluminium Non-Ferrous Metals', value: '0.4' },
            { source: 'Industrial Processes', target: 'Cement', value: '2.8' },
            { source: 'Industrial Processes', target: 'Chemicals', value: '1.4' },
            { source: 'Industrial Processes', target: 'Other Industry', value: '0.5' },
            { source: 'Industry', target: 'Aluminium Non-Ferrous Metals', value: '0.4' },
            { source: 'Industry', target: 'Cement', value: '1.9' },
            { source: 'Industry', target: 'Chemicals', value: '1.4' },
            { source: 'Industry', target: 'Food and Tobacco', value: '0.5' },
            { source: 'Industry', target: 'Iron and Steel', value: '3.0' },
            { source: 'Industry', target: 'Oil and Gas Processing', value: '2.8' },
            { source: 'Industry', target: 'Other Industry', value: '3.8' },
            { source: 'Industry', target: 'Pulp - Paper and Printing', value: '0.5' },
            { source: 'Iron and Steel', target: 'Carbon Dioxide', value: '4.0' },
            { source: 'Land Use Change', target: 'Deforestation', value: '10.9' },
            { source: 'Land Use Change', target: 'Harvest / Management', value: '1.3' },
            { source: 'Landfills', target: 'Methane', value: '1.7' },
            { source: 'Livestock and Manure', target: 'Methane', value: '5.1' },
            { source: 'Livestock and Manure', target: 'Nitrous Oxide', value: '0.3' },
            { source: 'Machinery', target: 'Carbon Dioxide', value: '1.0' },
            { source: 'Oil and Gas Processing', target: 'Carbon Dioxide', value: '3.6' },
            { source: 'Oil and Gas Processing', target: 'Methane', value: '2.8' },
            { source: 'Other Agriculture', target: 'Methane', value: '1.4' },
            { source: 'Other Agriculture', target: 'Nitrous Oxide', value: '0.3' },
            { source: 'Other Fuel Combustion', target: 'Agricultural Energy Use', value: '1.0' },
            { source: 'Other Fuel Combustion', target: 'Commercial Buildings', value: '1.3' },
            { source: 'Other Fuel Combustion', target: 'Residential Buildings', value: '5.0' },
            { source: 'Other Fuel Combustion', target: 'Unallocated Fuel Combustion', value: '1.8' },
            { source: 'Other Industry', target: 'Carbon Dioxide', value: '6.6' },
            { source: 'Other Industry', target: 'HFCs - PFCs', value: '0.4' },
            { source: 'Pulp - Paper and Printing', target: 'Carbon Dioxide', value: '1.1' },
            { source: 'Rail - Ship and Other Transport', target: 'Carbon Dioxide', value: '2.5' },
            { source: 'Residential Buildings', target: 'Carbon Dioxide', value: '10.2' },
            { source: 'Rice Cultivation', target: 'Methane', value: '1.5' },
            { source: 'Road', target: 'Carbon Dioxide', value: '10.5' },
            { source: 'T and D Losses', target: 'Carbon Dioxide', value: '2.2' },
            { source: 'Transportation', target: 'Air', value: '1.7' },
            { source: 'Transportation', target: 'Rail - Ship and Other Transport', value: '2.5' },
            { source: 'Transportation', target: 'Road', value: '10.5' },
            { source: 'Unallocated Fuel Combustion', target: 'Carbon Dioxide', value: '3.0' },
            { source: 'Unallocated Fuel Combustion', target: 'Methane', value: '0.4' },
            { source: 'Unallocated Fuel Combustion', target: 'Nitrous Oxide', value: '0.4' },
            { source: 'Waste', target: 'Landfills', value: '1.7' },
            { source: 'Waste', target: 'Waste water - Other Waste', value: '1.5' },
            { source: 'Waste water - Other Waste', target: 'Methane', value: '1.2' },
            { source: 'Waste water - Other Waste', target: 'Nitrous Oxide', value: '0.3' }
          ],
          nodes: [
            { name: 'Energy' },
            { name: 'Industrial Processes' },
            { name: 'Electricity and heat' },
            { name: 'Industry' },
            { name: 'Land Use Change' },
            { name: 'Agriculture' },
            { name: 'Waste' },
            { name: 'Transportation' },
            { name: 'Other Fuel Combustion' },
            { name: 'Fugitive Emissions' },
            { name: 'Road' },
            { name: 'Air' },
            { name: 'Rail - Ship and Other Transport' },
            { name: 'Residential Buildings' },
            { name: 'Commercial Buildings' },
            { name: 'Unallocated Fuel Combustion' },
            { name: 'Iron and Steel' },
            { name: 'Aluminium Non-Ferrous Metals' },
            { name: 'Machinery' },
            { name: 'Pulp - Paper and Printing' },
            { name: 'Food and Tobacco' },
            { name: 'Chemicals' },
            { name: 'Cement' },
            { name: 'Other Industry' },
            { name: 'T and D Losses' },
            { name: 'Coal Mining' },
            { name: 'Oil and Gas Processing' },
            { name: 'Deforestation' },
            { name: 'Harvest / Management' },
            { name: 'Agricultural Energy Use' },
            { name: 'Agriculture Soils' },
            { name: 'Livestock and Manure' },
            { name: 'Rice Cultivation' },
            { name: 'Other Agriculture' },
            { name: 'Landfills' },
            { name: 'Waste water - Other Waste' },
            { name: 'Carbon Dioxide' },
            { name: 'HFCs - PFCs' },
            { name: 'Methane' },
            { name: 'Nitrous Oxide' }
          ]
        }
      ]
    }
  ],
  categoryField: 'name',
  nodeKey: 'name',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',
  linkWidth: 400,
  overflow: 'scroll',

  nodeAlign: 'left',
  nodeGap: 8,
  nodeWidth: 10,
  minNodeHeight: 4,

  title: {
    text: 'Experimental Sankey diagram with a scrollbar',
    subtext: 'Source: https://observablehq.com/@aaronkyle/sankey-diagram',
    subtextStyle: {
      fontSize: 12
    }
  },

  label: {
    visible: true,
    style: {
      fontSize: 10
    }
  },

  node: {
    state: {
      hover: {
        stroke: '#333333'
      },
      selected: {
        fill: '#dddddd',
        stroke: '#333333',
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 1
      }
    }
  },

  link: {
    state: {
      hover: {
        fillOpacity: 1
      },
      selected: {
        fill: '#dddddd',
        stroke: '#333333',
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 1
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[桑基图](link)
