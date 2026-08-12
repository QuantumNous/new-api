import type { ICommonSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IGlyph, IGlyphGraphicAttribute, IGraphic } from '@visactor/vrender-core';
import type { IGlyphMark } from './interface/mark';
import type { MarkType } from './interface/type';
import type { Datum } from '../typings/common';
import type { IMarkGraphic } from './interface/common';
export declare abstract class GlyphMark<T extends ICommonSpec = ICommonSpec, Cfg = any> extends BaseMark<T> implements IGlyphMark<T, Cfg> {
    protected _defaultGlyphAttrs: T;
    protected _subMarks: Record<string, {
        type: MarkType;
        defaultAttributes?: any;
    }>;
    getSubMarks(): Record<string, {
        type: string;
        defaultAttributes?: any;
    }>;
    protected _glyphConfig: Cfg;
    setGlyphConfig(cfg: Cfg): void;
    getGlyphConfig(): Cfg;
    protected _positionChannels: string[];
    getPositionChannels(): string[];
    protected _positionEncoder: (glyphAttrs: any, datum: Datum, g: IGlyph) => Record<string, any>;
    protected _channelEncoder: Record<string, (channelValue: any) => Record<string, any>>;
    private _getInheritedStyleAttrs;
    private _getInheritedStyleAttrsMap;
    private _syncInheritedStyleAttrs;
    private _onGlyphAttributeUpdate;
    protected _setStateOfGraphic: (g: IMarkGraphic) => void;
    protected _createGraphic(attrs?: IGlyphGraphicAttribute): IGraphic;
    protected _runProgressiveEncoder(graphics: IMarkGraphic[]): void;
}
export declare const registerGlyphMark: () => void;
