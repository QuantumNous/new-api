import type { IMarkSpec, ISeriesSpec } from '../../typings/spec/common';
import type { IArcMarkSpec, IRectMarkSpec, IGroupMarkSpec } from '../../typings/visual';
export interface IProgressSeriesSpec extends ISeriesSpec {
    cornerRadius?: number;
    progress?: IMarkSpec<IArcMarkSpec> | IMarkSpec<IRectMarkSpec>;
    track?: IMarkSpec<IArcMarkSpec> | IMarkSpec<IGroupMarkSpec>;
}
