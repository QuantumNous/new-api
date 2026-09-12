import type { DataView } from '@visactor/vdataset';
import type { Datum } from '../../typings/common';

export interface IDimensionTreeOpt {
  fields: string[];
}

export const dimensionTree = (data: Array<DataView>, op: IDimensionTreeOpt) => {
  if (!op.fields) {
    return data;
  }
  const dataCollect = data
    .map(d => {
      return d.latestData;
    })
    .flat();
  const dimensionValues = {};
  return {
    dimensionValues,
    dimensionData: groups(dataCollect, op.fields, dimensionValues)
  };
};

function groups(data: Datum[], fields: string[], dimensionValues: object): any {
  if (fields.length === 0) {
    return data;
  }
  const first = fields[0];
  const _rest = fields.slice(1);
  dimensionValues[first] = new Set();

  const grouped = groupBy(data, first, dimensionValues[first]);
  if (_rest.length) {
    return mapValues(grouped, (value, key) => {
      return groups(value, _rest, dimensionValues);
    });
  }

  return grouped;
}

function groupBy(data: Datum[], field: string, set: Set<string>) {
  const groups = {};

  data.forEach(d => {
    const key = d[field];
    if (!groups[key]) {
      groups[key] = [];
      set.add(key);
    }
    groups[key].push(d);
  });
  return groups;
}

export function mapValues(target: object, fn: (value: any, key: string) => any) {
  return Object.keys(target).reduce((result, key) => {
    result[key] = fn(target[key], key);
    return result;
  }, {});
}

export function findDataInFields(data: any, fields: string[]): any {
  if (fields.length === 0) {
    return data;
  }
  const first = fields[0];
  const _rest = fields.slice(1);
  if (data[first] === undefined) {
    return undefined;
  }
  return findDataInFields(data[first], _rest);
}

/**
 *
  const data = [
    { type: "circle", color: "red", x: 10, y:100 },
    { type: "circle", color: "blue", x: 10, y:100 },
    { type: "rect", color: "red", x: 10, y:100 },
    { type: "rect", color: "blue", x: 10, y:100 },
  ]

  groups(data, ["circle", "color"])

  =====>
  {
    circle: {
      red:[{ type: "circle", color: "red", x: 10, y:100 }],
      blue:[{ type: "circle", color: "blue", x: 10, y:100 }]
    },
    rect:{
      red:[{ type: "rect", color: "red", x: 10, y:100 }],
      blue:[{ type: "rect", color: "blue", x: 10, y:100 }]
    }
  }
 */
