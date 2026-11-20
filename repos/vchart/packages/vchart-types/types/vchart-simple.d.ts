import { VChart as BaseVChart } from './core';
import type { IInitOption, ISpec } from './typings';
export * from './core';
declare class VChart extends BaseVChart {
    constructor(spec: ISpec, options: IInitOption);
}
export { VChart };
export default VChart;
