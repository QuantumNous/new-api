import type { BoxPlotShaftShape, IBoxPlotMarkSpec } from '../typings/visual';
import type { IBoxPlotMark, IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface/type';
import { GlyphMark } from './glyph';
export declare class BoxPlotMark extends GlyphMark<IBoxPlotMarkSpec, {
    direction?: 'horizontal' | 'vertical';
    shaftShape?: BoxPlotShaftShape;
}> implements IBoxPlotMark {
    static readonly type = MarkTypeEnum.boxPlot;
    readonly type = MarkTypeEnum.boxPlot;
    protected _isHorizontal(): boolean;
    setGlyphConfig(cfg: {
        direction?: 'horizontal' | 'vertical';
        shaftShape?: BoxPlotShaftShape;
    }): void;
    setDataLabelType(): string;
    protected _getDefaultStyle(): IMarkStyle<IBoxPlotMarkSpec>;
}
export declare const registerBoxPlotMark: () => void;
