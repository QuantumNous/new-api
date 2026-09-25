import type { IPointLike } from '@visactor/vutils';
import type { IPolarAxisSpec } from '../../component/axis/polar/interface';
import type { IPolarCrosshairSpec } from '../../component/crosshair/interface';
import type { IChartSpec, ILayoutRect } from '../../typings';
import type { IIndicatorSpec } from '../../component/indicator/interface';
export interface IPolarChartSpec extends IChartSpec {
    axes?: IPolarAxisSpec[];
    crosshair?: IPolarCrosshairSpec | IPolarCrosshairSpec[];
    layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);
    indicator?: IIndicatorSpec | IIndicatorSpec[];
}
