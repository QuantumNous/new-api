import type { DataSet, Parser, Transform } from '@visactor/vdataset';
export declare function registerDataSetInstanceTransform(dataSet: DataSet, name: string, transform: Transform): void;
export declare function registerDataSetInstanceParser(dataSet: DataSet, name: string, parse: Parser): void;
