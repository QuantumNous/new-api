import type { DataSet, Parser, Transform } from '@visactor/vdataset';

export function registerDataSetInstanceTransform(dataSet: DataSet, name: string, transform: Transform) {
  if (!dataSet.getTransform(name)) {
    dataSet.registerTransform(name, transform);
  }
}

export function registerDataSetInstanceParser(dataSet: DataSet, name: string, parse: Parser) {
  if (!dataSet.getParser(name)) {
    dataSet.registerParser(name, parse);
  }
}
