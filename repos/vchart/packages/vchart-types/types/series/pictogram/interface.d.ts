import type { IPathMarkSpec } from '../../typings/visual';
import type { IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings/spec/common';
import type { IAnimationSpec } from '../../animation/spec';
export interface IPictogramSeriesSpec extends ISeriesSpec, IAnimationSpec<'pictogram', 'fadeIn'> {
    type: 'pictogram';
    svg: string;
    nameField?: string;
    valueField?: string;
    pictogram?: IMarkSpec<Omit<IPathMarkSpec, 'smoothScale'>>;
    defaultFillColor?: string;
}
export interface IPictogramThemeSpec {
    defaultFillColor?: string;
    pictogram?: Partial<IMarkTheme<Omit<IPathMarkSpec, 'smoothScale'>>>;
}
