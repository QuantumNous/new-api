import { isNil, last, isEqual } from '@visactor/vutils';
import type { Layout } from './base-layout';
import type { ILayoutItem } from './interface';
import type { ILayoutRect } from '../typings';

export type IRecompute = {
  recomputeWidth: boolean;
  recomputeHeight: boolean;
};

function getPositionItems(items: ILayoutItem[]) {
  const startItems: ILayoutItem[] = [];
  const middleItems: ILayoutItem[] = [];
  const endItems: ILayoutItem[] = [];

  items.forEach(item => {
    if (isNil(item.getSpec().position) || item.getSpec().position === 'start') {
      startItems.push(item);
    } else if (item.getSpec().position === 'middle') {
      middleItems.push(item);
    } else if (item.getSpec().position === 'end') {
      endItems.push(item);
    }
  });

  return {
    startItems,
    endItems,
    middleItems
  };
}

function adjustItemsToCenter(allItems: ILayoutItem[][], isVertical: boolean, containerLength: number) {
  if (isVertical) {
    allItems.forEach(items => {
      const lastItem = last(items);
      const length =
        lastItem.getLayoutStartPoint().y + lastItem.getLayoutRect().height - items[0].getLayoutStartPoint().y;
      const centerY = (containerLength - length) / 2;

      items.forEach(item => {
        item.setLayoutStartPosition({
          x: item.getLayoutStartPoint().x,
          y: item.getLayoutStartPoint().y + centerY
        });
      });
    });
  } else {
    allItems.forEach(items => {
      const lastItem = last(items);
      const length =
        lastItem.getLayoutStartPoint().x + lastItem.getLayoutRect().width - items[0].getLayoutStartPoint().x;
      const centerX = (containerLength - length) / 2;

      items.forEach(item => {
        item.setLayoutStartPosition({
          x: item.getLayoutStartPoint().x + centerX,
          y: item.getLayoutStartPoint().y
        });
      });
    });
  }
}

function alignSelfOfItems(allItems: ILayoutItem[][], isVertical: boolean, maxSizes: number[], sign: number) {
  let maxSize: number;

  allItems.forEach((lineItems: ILayoutItem[], index: number) => {
    if (lineItems.length > 1) {
      maxSize = maxSizes[index];

      lineItems.forEach(item => {
        if (!item.alignSelf || item.alignSelf === 'start') {
          return;
        }

        const pos = item.getLayoutStartPoint();
        const ratio = item.alignSelf === 'middle' ? 0.5 : 1;
        const delta = isVertical
          ? maxSize - (item.getLayoutRect().width + item.layoutPaddingLeft + item.layoutPaddingRight)
          : maxSize - (item.getLayoutRect().height + item.layoutPaddingTop + item.layoutPaddingBottom);

        if (isVertical) {
          item.setLayoutStartPosition({
            x: pos.x + sign * delta * ratio,
            y: pos.y
          });
        } else {
          item.setLayoutStartPosition({
            x: pos.x,
            y: pos.y + sign * delta * ratio
          });
        }
      });
    }
  });
}

function layoutLeftRightStartOrMiddleItems(
  items: ILayoutItem[],
  layout: Layout,
  limitHeight: number,
  isMiddle: boolean,
  position: 'left' | 'right',
  recompute: IRecompute
) {
  if (items.length) {
    let maxWidth = 0;
    const isRight = position === 'right';
    const xSign = isRight ? -1 : 1;
    let preX = isRight ? layout.rightCurrent : layout.leftCurrent;
    let preTop = layout.topCurrent;

    const allItems: ILayoutItem[][] = [];
    let singleLineItems: ILayoutItem[] = [];
    const maxWidths: number[] = [];
    items.forEach(item => {
      const { rect } = getItemLayoutWithTag(item, layout, recompute);
      const itemTotalHeight = rect.height + item.layoutPaddingTop + item.layoutPaddingBottom;
      const itemTotalWidth = rect.width + item.layoutPaddingLeft + item.layoutPaddingRight;
      const itemOffsetX = isRight ? -rect.width - item.layoutPaddingRight : item.layoutPaddingLeft;
      item.setLayoutStartPosition({
        x: preX + item.layoutOffsetX + itemOffsetX,
        y: preTop + item.layoutOffsetY + item.layoutPaddingTop
      });

      preTop += itemTotalHeight;
      if (preTop > limitHeight && singleLineItems.length) {
        maxWidths.push(maxWidth);
        preX += xSign * maxWidth;
        maxWidth = itemTotalWidth;
        preTop = layout.topCurrent + itemTotalHeight;

        item.setLayoutStartPosition({
          x: preX + item.layoutOffsetX + itemOffsetX,
          y: layout.topCurrent + item.layoutOffsetY + item.layoutPaddingTop
        });
        allItems.push(singleLineItems);
        singleLineItems = [item];
      } else {
        maxWidth = Math.max(maxWidth, itemTotalWidth);
        singleLineItems.push(item);
      }
    });
    maxWidths.push(maxWidth);
    allItems.push(singleLineItems);

    alignSelfOfItems(allItems, true, maxWidths, xSign);

    if (isMiddle) {
      adjustItemsToCenter(allItems, true, limitHeight);
    }

    if (isRight) {
      layout.rightCurrent = preX + xSign * maxWidth;
    } else {
      layout.leftCurrent = preX + xSign * maxWidth;
    }
  }
}

function layoutLeftRightEndItems(
  items: ILayoutItem[],
  layout: Layout,
  limitWidth: number,
  position: 'left' | 'right',
  recompute: IRecompute
) {
  if (items.length) {
    let maxWidth = 0;
    const isRight = position === 'right';
    const xSign = isRight ? -1 : 1;
    let preX = isRight ? layout.rightCurrent : layout.leftCurrent;
    let preBottom = layout.bottomCurrent;

    const allItems: ILayoutItem[][] = [];
    let singleLineItems: ILayoutItem[] = [];
    const maxWidths: number[] = [];
    items.forEach(item => {
      const { rect } = getItemLayoutWithTag(item, layout, recompute);
      const itemTotalHeight = rect.height + item.layoutPaddingTop + item.layoutPaddingBottom;
      const itemTotalWidth = rect.width + item.layoutPaddingLeft + item.layoutPaddingRight;
      const itemOffsetX = isRight ? -rect.width - item.layoutPaddingRight : item.layoutPaddingLeft;

      if (preBottom < itemTotalHeight && singleLineItems.length) {
        maxWidths.push(maxWidth);
        preX += xSign * maxWidth;
        maxWidth = itemTotalWidth;
        preBottom = layout.bottomCurrent;

        item.setLayoutStartPosition({
          x: preX + item.layoutOffsetX + itemOffsetX,
          y: preBottom + item.layoutOffsetY - rect.height - item.layoutPaddingBottom
        });
        allItems.push(singleLineItems);
        singleLineItems = [item];
      } else {
        item.setLayoutStartPosition({
          x: preX + item.layoutOffsetX + itemOffsetX,
          y: preBottom + item.layoutOffsetY - rect.height - item.layoutPaddingBottom
        });
        maxWidth = Math.max(maxWidth, itemTotalWidth);
        preBottom -= itemTotalHeight;
        singleLineItems.push(item);
      }
    });
    maxWidths.push(maxWidth);
    allItems.push(singleLineItems);

    alignSelfOfItems(allItems, true, maxWidths, xSign);

    if (isRight) {
      layout.rightCurrent = preX + xSign * maxWidth;
    } else {
      layout.leftCurrent = preX + xSign * maxWidth;
    }
  }
}

function layoutTopBottomStartOrMiddleItems(
  items: ILayoutItem[],
  layout: Layout,
  limitWidth: number,
  isMiddle: boolean,
  position: 'top' | 'bottom',
  recompute: IRecompute
) {
  if (items.length) {
    const isTop = position === 'top';
    const ySign = isTop ? 1 : -1;
    let maxHeight = 0;
    let preLeft = layout.leftCurrent;
    let preY = isTop ? layout.topCurrent : layout.bottomCurrent;
    const allItems: ILayoutItem[][] = [];
    let singleLineItems: ILayoutItem[] = [];
    const maxHeights: number[] = [];

    items.forEach(item => {
      const { rect } = getItemLayoutWithTag(item, layout, recompute);
      const itemTotalHeight = rect.height + item.layoutPaddingTop + item.layoutPaddingBottom;
      const itemTotalWidth = rect.width + item.layoutPaddingLeft + item.layoutPaddingRight;
      const itemOffsetY = isTop ? item.layoutPaddingTop : -rect.height - item.layoutPaddingBottom;
      item.setLayoutStartPosition({
        x: preLeft + item.layoutOffsetX + item.layoutPaddingLeft,
        y: preY + item.layoutOffsetY + itemOffsetY
      });

      preLeft += itemTotalWidth;
      if (preLeft > limitWidth && singleLineItems.length) {
        maxHeights.push(maxHeight);
        preLeft = layout.leftCurrent + itemTotalWidth;
        preY += ySign * maxHeight;
        maxHeight = itemTotalHeight;
        item.setLayoutStartPosition({
          x: layout.leftCurrent + item.layoutOffsetX + item.layoutPaddingLeft,
          y: preY + item.layoutOffsetY + itemOffsetY
        });
        allItems.push(singleLineItems);
        singleLineItems = [item];
      } else {
        maxHeight = Math.max(maxHeight, itemTotalHeight);
        singleLineItems.push(item);
      }
    });
    maxHeights.push(maxHeight);
    allItems.push(singleLineItems);

    alignSelfOfItems(allItems, false, maxHeights, ySign);

    if (isMiddle) {
      adjustItemsToCenter(allItems, false, limitWidth);
    }

    if (isTop) {
      layout.topCurrent = preY + ySign * maxHeight;
    } else {
      layout.bottomCurrent = preY + ySign * maxHeight;
    }
  }
}

function layoutTopBottomEndItems(
  items: ILayoutItem[],
  layout: Layout,
  limitWidth: number,
  position: 'top' | 'bottom',
  recompute: IRecompute
) {
  if (items.length) {
    const isTop = position === 'top';
    const ySign = isTop ? 1 : -1;
    let maxHeight = 0;
    let preRight = layout.rightCurrent;
    let preY = isTop ? layout.topCurrent : layout.bottomCurrent;

    const allItems: ILayoutItem[][] = [];
    let singleLineItems: ILayoutItem[] = [];
    const maxHeights: number[] = [];

    items.forEach(item => {
      const { layoutTag, layoutRect, rect } = getItemLayoutWithTag(item, layout, recompute);
      const itemTotalHeight = rect.height + item.layoutPaddingTop + item.layoutPaddingBottom;
      const itemTotalWidth = rect.width + item.layoutPaddingLeft + item.layoutPaddingRight;
      const itemOffsetY = isTop ? item.layoutPaddingTop : -rect.height - item.layoutPaddingBottom;

      if (preRight < itemTotalWidth && singleLineItems.length) {
        preRight = layout.rightCurrent;
        preY += ySign * maxHeight;
        maxHeight = itemTotalHeight;

        item.setLayoutStartPosition({
          x: layout.rightCurrent + item.layoutOffsetX - rect.width - item.layoutPaddingRight,
          y: preY + item.layoutOffsetY + itemOffsetY
        });
        allItems.push(singleLineItems);
        singleLineItems = [item];
      } else {
        singleLineItems.push(item);
        item.setLayoutStartPosition({
          x: preRight + item.layoutOffsetX - rect.width - item.layoutPaddingRight,
          y: preY + item.layoutOffsetY + itemOffsetY
        });
        maxHeight = Math.max(maxHeight, itemTotalHeight);
        preRight -= itemTotalWidth;
      }
    });
    maxHeights.push(maxHeight);
    allItems.push(singleLineItems);

    alignSelfOfItems(allItems, false, maxHeights, ySign);

    if (isTop) {
      layout.topCurrent = preY + ySign * maxHeight;
    } else {
      layout.bottomCurrent = preY + ySign * maxHeight;
    }
  }
}

export function layoutLeftInlineItems(
  items: ILayoutItem[],
  layout: Layout,
  limitHeight: number,
  recompute: IRecompute
) {
  const { startItems, middleItems, endItems } = getPositionItems(items);
  if (startItems.length) {
    layoutLeftRightStartOrMiddleItems(startItems, layout, limitHeight, false, 'left', recompute);
  }

  if (middleItems.length) {
    layoutLeftRightStartOrMiddleItems(middleItems, layout, limitHeight, true, 'left', recompute);
  }

  if (endItems.length) {
    layoutLeftRightEndItems(endItems, layout, limitHeight, 'left', recompute);
  }
}

export function layoutRightInlineItems(
  items: ILayoutItem[],
  layout: Layout,
  limitHeight: number,
  recompute: IRecompute
) {
  const { startItems, middleItems, endItems } = getPositionItems(items);

  if (startItems.length) {
    layoutLeftRightStartOrMiddleItems(startItems, layout, limitHeight, false, 'right', recompute);
  }

  if (middleItems.length) {
    layoutLeftRightStartOrMiddleItems(middleItems, layout, limitHeight, true, 'right', recompute);
  }

  if (endItems.length) {
    layoutLeftRightEndItems(endItems, layout, limitHeight, 'right', recompute);
  }
}

export function layoutTopInlineItems(items: ILayoutItem[], layout: Layout, limitWidth: number, recompute: IRecompute) {
  const { startItems, middleItems, endItems } = getPositionItems(items);

  if (startItems.length) {
    layoutTopBottomStartOrMiddleItems(startItems, layout, limitWidth, false, 'top', recompute);
  }

  if (middleItems.length) {
    layoutTopBottomStartOrMiddleItems(middleItems, layout, limitWidth, true, 'top', recompute);
  }

  if (endItems.length) {
    layoutTopBottomEndItems(endItems, layout, limitWidth, 'top', recompute);
  }
}

export function layoutBottomInlineItems(
  items: ILayoutItem[],
  layout: Layout,
  limitWidth: number,
  recompute: IRecompute
) {
  const { startItems, middleItems, endItems } = getPositionItems(items);

  if (startItems.length) {
    layoutTopBottomStartOrMiddleItems(startItems, layout, limitWidth, false, 'bottom', recompute);
  }

  if (middleItems.length) {
    layoutTopBottomStartOrMiddleItems(middleItems, layout, limitWidth, true, 'bottom', recompute);
  }

  if (endItems.length) {
    layoutTopBottomEndItems(endItems, layout, limitWidth, 'bottom', recompute);
  }
}

export function getItemLayoutWithTag(
  item: ILayoutItem,
  layout: Layout,
  recompute: IRecompute,
  setRectToItem: boolean = true
) {
  let layoutRect;
  let rect;
  // 如果当前 item 自身不需要布局，同时当前的高度没有变化，那么直接复用上次的布局结果
  // 这里认为左右两侧布局的元素，如果提供给他的布局高度不变，那么 rect 理论上也不会变化，可以直接复用上次的布局结果
  let checkTagKey: keyof IRecompute = 'recomputeHeight';
  let setTagKey: keyof IRecompute = 'recomputeWidth';
  let rectKey: keyof ILayoutRect = 'width';
  if (item.layoutOrient === 'top' || item.layoutOrient === 'bottom') {
    checkTagKey = 'recomputeWidth';
    setTagKey = 'recomputeHeight';
    rectKey = 'height';
  }
  let layoutTag = !(!item.willLayoutTag && recompute[checkTagKey] === false);
  if (layoutTag) {
    const lastRect = { ...item.getLayoutRect() };
    const lastLayoutRect = item.lastComputeRect;
    layoutRect = layout.getItemComputeLayoutRect(item);
    // 再次判定，如果当前 item 自身不需要布局，同时当前的布局空间没变化
    if (!item.willLayoutTag && isEqual(layoutRect, lastLayoutRect)) {
      layoutTag = false;
      rect = item.getLayoutRect();
    } else {
      rect = item.computeBoundsInRect(layoutRect);
      // 如果当前布局了，但是结果没变化，那么也不需要重新布局
      // 注意左右2侧只考虑的宽度变化, 上下2侧只考虑的高度变化
      if (isEqual(lastRect[rectKey], rect[rectKey])) {
        layoutTag = false;
      } else {
        setRectToItem && item.setLayoutRect(rect);
        recompute[setTagKey] = true;
      }
    }
  } else {
    layoutRect = item.getLastComputeOutBounds();
    rect = item.getLayoutRect();
  }

  return {
    layoutRect,
    rect,
    layoutTag
  };
}
