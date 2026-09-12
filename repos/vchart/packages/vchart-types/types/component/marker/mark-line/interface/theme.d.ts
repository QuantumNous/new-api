import type { IMarkCommonArcLabelPosition, IMarkLineLabelPosition } from '@visactor/vrender-components';
import type { IArcMarkSpec, ILineMarkSpec } from '../../../../typings';
import type { IMarkerLabelSpec, IMarkerState, IMarkerSymbol } from '../../interface';
export type IMarkLineLabel = {
    position?: keyof typeof IMarkLineLabelPosition | IMarkCommonArcLabelPosition;
} & IMarkerLabelSpec;
export interface IMarkLineTheme {
    line?: Partial<IMarkerState<ILineMarkSpec | IArcMarkSpec>>;
    label?: IMarkLineLabel | IMarkLineLabel[];
    startSymbol?: IMarkerSymbol;
    endSymbol?: IMarkerSymbol;
}
