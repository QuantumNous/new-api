import type { IGraphic } from '@visactor/vrender-core';
import type { IMarkGraphic } from '../mark/interface/common';
export declare const isCollectionMark: (type: string) => boolean;
export declare const getDatumOfGraphic: (g: IMarkGraphic) => import("..").Datum;
export declare const findMarkGraphic: (rootGroup: IGraphic, target: IGraphic) => IGraphic<Partial<import("@visactor/vrender-core").IGraphicAttribute>>;
export declare const getDiffAttributesOfGraphic: (g: IMarkGraphic, newAttrs: any) => Record<string, any>;
