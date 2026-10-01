import type { IChartSpec } from '../../typings/spec/common';
import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface';
import type { ICartesianCrosshairSpec } from '../../component/crosshair/interface';
import type { IMarkLineSpec } from '../../component/marker/mark-line/interface';
import type { IMarkAreaSpec } from '../../component/marker/mark-area/interface';
import type { IMarkPointSpec } from '../../component/marker/mark-point/interface';
import type { DirectionType } from '../../typings';
export interface ICartesianChartSpec extends IChartSpec {
    direction?: DirectionType;
    axes?: ICartesianAxisSpec[];
    crosshair?: ICartesianCrosshairSpec | ICartesianCrosshairSpec[];
    markLine?: IMarkLineSpec | IMarkLineSpec[];
    markArea?: IMarkAreaSpec | IMarkAreaSpec[];
    markPoint?: IMarkPointSpec | IMarkPointSpec[];
}
