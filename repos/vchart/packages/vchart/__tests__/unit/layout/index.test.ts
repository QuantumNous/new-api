import { Layout } from '../../../src/layout';
import { LayoutItem } from '../../../src/layout/layout-item';
import type { ILayoutRect } from '../../../src/typings/layout';

const itemBoundsInRect = (item: LayoutItem) => {
  return (rect: ILayoutRect) => {
    return {
      x1: item.getLayoutStartPoint().x,
      y1: item.getLayoutStartPoint().y,
      x2: item.getLayoutStartPoint().x + item.getLayoutRect().width,
      y2: item.getLayoutStartPoint().y + item.getLayoutRect().height ?? rect.height
    };
  };
};

describe('layout simple line chart', () => {
  test('get correct start point & rect', () => {
    // hack region
    const region = new LayoutItem(
      {
        getBoundsInRect: (rect: ILayoutRect) => itemBoundsInRect(region)(rect),
        id: 1
      } as any,
      { layoutType: 'normal', layoutLevel: 1 }
    );
    region.layoutType = 'region';
    region.layoutLevel = 100;

    const leftAxis1 = new LayoutItem(
      {
        getBoundsInRect: (rect: ILayoutRect) => itemBoundsInRect(leftAxis1)(rect)
      } as any,
      { layoutType: 'normal', layoutLevel: 1 }
    );
    leftAxis1.layoutType = 'region-relative';
    leftAxis1.setLayoutRect({ width: 20 });
    leftAxis1.layoutOrient = 'left';
    leftAxis1.layoutLevel = 202;
    leftAxis1.layoutBindRegionID = [1];

    const leftAxis2 = new LayoutItem(
      {
        getBoundsInRect: (rect: ILayoutRect) => itemBoundsInRect(leftAxis2)(rect)
      } as any,
      { layoutType: 'normal', layoutLevel: 1 }
    );
    leftAxis2.layoutType = 'region-relative';
    leftAxis2.setLayoutRect({ width: 20 });
    leftAxis2.layoutOrient = 'left';
    leftAxis2.layoutLevel = 202;
    leftAxis2.layoutBindRegionID = [1];

    const bottomAxis = new LayoutItem(
      {
        getBoundsInRect: (rect: ILayoutRect) => itemBoundsInRect(bottomAxis)(rect)
      } as any,
      { layoutType: 'normal', layoutLevel: 1 }
    );
    bottomAxis.layoutOrient = 'bottom';
    bottomAxis.layoutType = 'region-relative';
    bottomAxis.setLayoutRect({ height: 20 });
    bottomAxis.layoutLevel = 202;
    bottomAxis.layoutBindRegionID = [1];

    const bottomLegend = new LayoutItem(
      {
        getBoundsInRect: (rect: ILayoutRect) => itemBoundsInRect(bottomLegend)(rect)
      } as any,
      { layoutType: 'normal', layoutLevel: 1 }
    );
    bottomLegend.layoutOrient = 'bottom';
    bottomLegend.setLayoutRect({
      width: 50
    });
    bottomLegend.setLayoutRect({
      height: 10
    });
    bottomLegend.layoutLevel = 302;

    const layout = new Layout();
    layout.layoutItems(
      null as any,
      [region, leftAxis1, leftAxis2, bottomAxis, bottomLegend],
      {
        width: 100,
        height: 100,
        x: 50,
        y: 0
      },
      {
        x1: 50,
        x2: 150,
        y1: 0,
        y2: 100
      }
    );

    expect(leftAxis1.getLayoutStartPoint()).toEqual({ x: 50, y: 0 });
    expect(leftAxis1.getLayoutRect()).toEqual({ width: 20, height: 70 });

    expect(leftAxis2.getLayoutStartPoint()).toEqual({ x: 70, y: 0 });
    expect(leftAxis2.getLayoutRect()).toEqual({ width: 20, height: 70 });

    expect(bottomAxis.getLayoutStartPoint()).toEqual({ x: 90, y: 70 });
    expect(bottomAxis.getLayoutRect()).toEqual({ width: 60, height: 20 });

    expect(bottomLegend.getLayoutStartPoint()).toEqual({ x: 50, y: 90 });

    expect(region.getLayoutStartPoint()).toEqual({ x: 90, y: 0 });
    expect(region.getLayoutRect()).toEqual({ width: 60, height: 70 });
  });
});
