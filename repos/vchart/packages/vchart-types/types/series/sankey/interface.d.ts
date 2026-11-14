import type { ISeriesSpec, DirectionType, IMarkTheme } from '../../typings';
import type { IMarkSpec } from '../../typings/spec/common';
import type { IRectMarkSpec, ILinkPathMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILabelSpec } from '../../component/label/interface';
export type SankeyMark = 'node' | 'link' | 'label';
export type SankeyAppearPreset = 'growIn' | 'fadeIn';
export interface ISankeyAnimationParams {
    direction: DirectionType;
    growFrom: () => number;
}
export type ISankeyLabelSpec = ILabelSpec & {
    position?: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right';
    limit?: number;
};
export interface ISankeySeriesSpec extends Omit<ISeriesSpec, 'data'>, IAnimationSpec<SankeyMark, SankeyAppearPreset> {
    type: 'sankey';
    categoryField: string;
    valueField: string;
    sourceField?: string;
    targetField?: string;
    direction?: DirectionType;
    nodeAlign?: 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';
    crossNodeAlign?: 'start' | 'end' | 'middle' | 'parent';
    inverse?: boolean;
    nodeGap?: number;
    nodeWidth?: string | number | ((node: SankeyNodeElement) => number);
    linkWidth?: number | ((link: SankeyLinkElement) => number);
    minStepWidth?: number;
    minNodeHeight?: number;
    minLinkHeight?: number;
    maxNodeHeight?: number;
    maxLinkHeight?: number;
    iterations?: number;
    nodeKey?: string | number | ((datum: SankeyNodeDatum) => string | number);
    linkSortBy?: (a: SankeyLinkElement, b: SankeyLinkElement) => number;
    nodeSortBy?: (a: SankeyNodeElement, b: SankeyNodeElement) => number;
    setNodeLayer?: (datum: SankeyNodeDatum) => number;
    dropIsolatedNode?: boolean;
    nodeHeight?: number | ((node: SankeyNodeElement) => number);
    linkHeight?: number | ((link: SankeyLinkElement, sourceNode: SankeyNodeElement, sourceNodeHeight: number) => number);
    equalNodeHeight?: boolean;
    linkOverlap?: 'start' | 'center' | 'end';
    [SeriesMarkNameEnum.node]?: IMarkSpec<IRectMarkSpec>;
    [SeriesMarkNameEnum.link]?: IMarkSpec<ILinkPathMarkSpec>;
    emphasis?: {
        enable: boolean;
        trigger?: 'click' | 'hover';
        effect: 'self' | 'adjacency' | 'related';
    };
    [SeriesMarkNameEnum.label]?: ISankeyLabelSpec | ISankeyLabelSpec[];
    overflow?: 'scroll' | 'hidden' | 'scroll-x' | 'scroll-y';
}
export interface SankeyLinkDatum {
    source: string | number;
    target: string | number;
    value?: number;
}
export interface SankeyNodeDatum {
    value?: number;
}
export interface HierarchyNodeDatum {
    value?: number;
    children?: HierarchyNodeDatum[];
}
export type SankeyData = {
    nodes?: SankeyNodeDatum[];
    links: SankeyLinkDatum[];
} | {
    nodes: HierarchyNodeDatum[];
};
export interface SankeyNodeElement {
    key: string | number;
    index: number;
    depth: number;
    endDepth?: number;
    layer?: number;
    isLastLayer?: boolean;
    value: number;
    datum: SankeyNodeDatum;
    sourceLinks: SankeyLinkElement[];
    targetLinks: SankeyLinkElement[];
    x0?: number;
    y0?: number;
    x1?: number;
    y1?: number;
}
export interface SankeyLinkElement {
    vertical?: boolean;
    index: number;
    source: string | number;
    target: string | number;
    value: number;
    datum: SankeyLinkDatum | SankeyLinkDatum[];
    thickness?: number;
    sourceRect?: {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
    };
    targetRect?: {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
    };
    parents?: (string | number)[];
    y0?: number;
    y1?: number;
    x0?: number;
    x1?: number;
}
export type SankeyLayoutResult = {
    nodes: SankeyNodeElement[];
    links: SankeyLinkElement[];
    columns: SankeyNodeElement[][];
}[];
export interface ISankeySeriesTheme {
    [SeriesMarkNameEnum.node]?: IMarkTheme<IRectMarkSpec>;
    [SeriesMarkNameEnum.link]?: IMarkTheme<ILinkPathMarkSpec>;
}
