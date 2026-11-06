import type { IChartSpec } from '../../typings/spec/common';
import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface';
import type { IPolarAxisSpec } from '../../component/axis/polar/interface';
export interface IProgressChartSpec extends IChartSpec {
    seriesField?: string;
    cornerRadius?: number;
    axes?: ICartesianAxisSpec[] | IPolarAxisSpec[];
}
