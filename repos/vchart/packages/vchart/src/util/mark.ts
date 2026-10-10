import type { IGraphic } from '@visactor/vrender-core';
import { MarkTypeEnum } from '../mark/interface';
import type { IMarkGraphic } from '../mark/interface/common';

type GlyphHostedGraphic = IGraphic & {
  glyphHost?: IGraphic;
};

const getMarkGraphicHost = (graphic: IGraphic) => ((graphic as GlyphHostedGraphic)?.glyphHost ?? graphic) as IGraphic;

export const isCollectionMark = (type: string) => {
  return type === MarkTypeEnum.line || type === MarkTypeEnum.area;
};

export const getDatumOfGraphic = (g: IMarkGraphic) => {
  if (!g || !g.context) {
    return null;
  }

  const { data, markType } = g.context;
  if (isCollectionMark(markType)) {
    return data;
  }

  return data?.[0];
};

export const findMarkGraphic = (rootGroup: IGraphic, target: IGraphic) => {
  let g = getMarkGraphicHost(target);

  if ((g as IMarkGraphic)?.context) {
    return g;
  }

  while (g?.parent && g.parent !== rootGroup) {
    g = getMarkGraphicHost(g.parent);

    if ((g as IMarkGraphic).context) {
      return g;
    }
  }

  return null;
};

export const getDiffAttributesOfGraphic = (g: IMarkGraphic, newAttrs: any) => {
  // diff一下，获取差异的属性
  const prevAttrs: Record<string, any> = g.getAttributes(true);
  const diffAttrs: Record<string, any> = {};
  Object.keys(newAttrs).forEach(key => {
    if (prevAttrs[key] !== newAttrs[key]) {
      diffAttrs[key] = newAttrs[key];
    }
  });

  return diffAttrs;
};
