import type { ISymbolGraphicAttribute } from '@visactor/vrender-core';
import { PREFIX } from '../../constant/base';
import { isNil } from '@visactor/vutils';
import { Factory } from '../../core/factory';
import type { IMarkGraphic } from '../interface';

export const OVERLAP_HIDE_KEY = `${PREFIX}_hide_`;

function setVisible(g: IMarkGraphic, visible: boolean) {
  if (g.context.finalAttrs) {
    g.context.finalAttrs.visible = visible;
  }
}

function reset(graphics: IMarkGraphic[]) {
  graphics.forEach(g => {
    const hide = (g as any)[OVERLAP_HIDE_KEY];

    if (hide) {
      setVisible(g, true);

      (g as any)[OVERLAP_HIDE_KEY] = false;
    }
  });
  return graphics;
}

function overlapX(graphics: IMarkGraphic[], delta: number, deltaMul: number) {
  let lastX = -Infinity;
  let lastR = 0;
  const useDeltaMul = isNil(delta);
  let itemDelta = delta;

  graphics.forEach(g => {
    if (g.context.finalAttrs.visible === false) {
      // skip hidden points
      return;
    }

    const r = ((g.context.finalAttrs as ISymbolGraphicAttribute).size as number) / 2;
    const currentX = g.context.finalAttrs.x;
    if (useDeltaMul) {
      itemDelta = (r + lastR) * deltaMul;
    }
    if (Math.abs(currentX - lastX) < itemDelta + lastR + r) {
      if (!(g.context.finalAttrs as any).forceShow) {
        (g as any)[OVERLAP_HIDE_KEY] = true;

        setVisible(g, false);
      }
    } else {
      lastX = currentX;
    }

    lastR = r;
  });
}

function overlapY(graphics: IMarkGraphic[], delta: number, deltaMul: number) {
  let lastY = -Infinity;
  let lastR = 0;
  const useDeltaMul = isNil(delta);
  let itemDelta = delta;

  graphics.forEach(g => {
    if (g.context.finalAttrs.visible === false) {
      // skip hidden points
      return;
    }

    const r = ((g.context.finalAttrs as ISymbolGraphicAttribute).size as number) / 2;
    const currentY = g.context.finalAttrs.y;
    if (useDeltaMul) {
      itemDelta = (r + lastR) * deltaMul;
    }
    if (Math.abs(currentY - lastY) < itemDelta + lastR + r) {
      if (!(g.context.finalAttrs as any).forceShow) {
        (g as any)[OVERLAP_HIDE_KEY] = true;

        setVisible(g, false);
      }
    } else {
      lastY = currentY;
    }

    lastR = r;
  });
}

function overlapXY(graphics: IMarkGraphic[], delta: number, deltaMul: number) {
  const lastX = -Infinity;
  let lastY = -Infinity;
  let lastR = 0;
  let dis = 0;
  const useDeltaMul = isNil(delta);
  let itemDelta = delta;

  graphics.forEach(g => {
    if (g.context.finalAttrs.visible === false) {
      // skip hidden points
      return;
    }

    const r = ((g.context.finalAttrs as ISymbolGraphicAttribute).size as number) / 2;
    const { x: currentX, y: currentY } = g.context.finalAttrs;

    if (useDeltaMul) {
      itemDelta = (r + lastR) * deltaMul;
    }
    dis = (lastX - currentX) ** 2 + (lastY - currentY) ** 2;
    if (dis < (itemDelta + lastR + r) ** 2) {
      if (!(g.context.finalAttrs as any).forceShow) {
        (g as any)[OVERLAP_HIDE_KEY] = true;

        setVisible(g, false);
      }
    } else {
      lastY = currentY;
    }

    lastR = r;
  });
}

/**
 * 针对mark的防重叠
 * @param {object} options - The parameters for this operator.
 * @param {data} [options.followMark]
 * @constructor
 */
export const transform = (
  options: {
    direction: number;
    delta?: number;
    deltaMul?: number;
    hideMode?: number;
    forceUpdate?: boolean;
    forceUpdateStamp?: number;
    groupBy?: string;
    sort?: boolean;
  },
  upstreamData: IMarkGraphic[]
) => {
  if (!upstreamData || upstreamData.length === 0) {
    return upstreamData;
  }

  const { direction, delta, deltaMul = 1, groupBy } = options;

  const handleOverlap = (graphics: IMarkGraphic[]) => {
    reset(graphics);

    const sortedgraphics = options.sort
      ? graphics.slice().sort((a, b) => {
          return a.context.finalAttrs.x - b.context.finalAttrs.x;
        })
      : graphics;

    if (direction === 0) {
      overlapXY(sortedgraphics, delta, deltaMul);
    } else if (direction === 1) {
      overlapX(sortedgraphics, delta, deltaMul);
    } else {
      overlapY(sortedgraphics, delta, deltaMul);
    }
  };

  if (!groupBy) {
    handleOverlap(upstreamData);
  } else {
    // 分组
    const map = upstreamData.reduce((res: { [key: string]: IMarkGraphic[] }, g: IMarkGraphic) => {
      const groupName = g.context.data?.[0]?.[groupBy];

      if (res[groupName]) {
        res[groupName].push(g);
      } else {
        res[groupName] = [g];
      }

      return res;
    }, {});

    Object.keys(map).forEach(key => {
      handleOverlap(map[key]);
    });
  }

  return upstreamData;
};

export const registerSymbolOverlapTransform = () => {
  Factory.registerGrammarTransform('symbolOverlap', {
    transform,
    runType: 'afterEncode'
  });
};
