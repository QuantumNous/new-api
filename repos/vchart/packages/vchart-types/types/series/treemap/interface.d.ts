import type { IRectMarkSpec, ITextMarkSpec } from '../../typings';
import type { IHierarchyData, IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings/spec';
import type { TreemapOptions } from '@visactor/vlayouts';
import type { ICartesianSeriesTheme } from '../cartesian/interface';
import type { IAnimationSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILabelSpec } from '../../component/label/interface';
export type TreemapMark = 'leaf' | 'nonLeaf';
export type TreemapAppearPreset = 'growIn' | 'fadeIn';
export interface ITreemapSeriesSpec extends Omit<ISeriesSpec, 'data'>, IAnimationSpec<TreemapMark, TreemapAppearPreset> {
    type: 'treemap';
    categoryField: string;
    valueField: string;
    data: IHierarchyData;
    aspectRatio?: number;
    splitType?: TreemapOptions['splitType'];
    gapWidth?: TreemapOptions['gapWidth'];
    nodePadding?: TreemapOptions['padding'];
    maxDepth?: TreemapOptions['maxDepth'];
    minVisibleArea?: TreemapOptions['minVisibleArea'];
    minChildrenVisibleArea?: TreemapOptions['minChildrenVisibleArea'];
    minChildrenVisibleSize?: TreemapOptions['minChildrenVisibleSize'];
    roam?: boolean;
    drill?: boolean;
    drillField?: string;
    [SeriesMarkNameEnum.leaf]?: IMarkSpec<IRectMarkSpec>;
    [SeriesMarkNameEnum.nonLeaf]?: IMarkSpec<IRectMarkSpec>;
    [SeriesMarkNameEnum.label]?: Omit<ILabelSpec, 'position' | 'overlap'>;
    [SeriesMarkNameEnum.nonLeafLabel]?: Omit<ILabelSpec, 'position' | 'overlap'> & {
        position?: TreemapOptions['labelPosition'];
        padding?: TreemapOptions['labelPadding'];
    };
}
export interface ITreemapSeriesTheme extends ICartesianSeriesTheme {
    gapWidth?: TreemapOptions['padding'];
    nodePadding?: TreemapOptions['padding'];
    [SeriesMarkNameEnum.leaf]?: Partial<IMarkTheme<IRectMarkSpec>>;
    [SeriesMarkNameEnum.nonLeaf]?: Partial<IMarkTheme<IRectMarkSpec>>;
    [SeriesMarkNameEnum.label]?: Partial<IMarkTheme<ITextMarkSpec>>;
    [SeriesMarkNameEnum.nonLeafLabel]?: Partial<IMarkTheme<ITextMarkSpec> & {
        padding?: TreemapOptions['labelPadding'];
    }>;
}
