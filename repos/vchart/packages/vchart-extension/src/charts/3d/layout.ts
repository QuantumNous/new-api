import type { IBoundsLike } from '@visactor/vutils';
import type { IChart } from '@visactor/vchart/esm/chart/interface/chart';
import { isXAxis, isYAxis } from '@visactor/vchart/esm/component/axis/cartesian/util/common';
import type { IAxis } from '@visactor/vchart/esm/component/axis/interface/common';
import { Factory } from '@visactor/vchart/esm/core/factory';
import { Layout, type IOffset, type LayoutSideType } from '@visactor/vchart/esm/layout/base-layout';
import type { IBaseLayout, ILayoutItem } from '@visactor/vchart/esm/layout/interface';
import type { IRect } from '@visactor/vchart/esm/typings/space';

export class Layout3d extends Layout implements IBaseLayout {
  declare recomputeWidth: boolean;
  declare recomputeHeight: boolean;
  static type = 'layout3d';

  layoutItems(_chart: IChart, items: ILayoutItem[], chartLayoutRect: IRect, chartViewBox: IBoundsLike): void {
    // 布局初始化
    this._layoutInit(_chart, items, chartLayoutRect, chartViewBox);

    const recompute = {
      recomputeWidth: this.recomputeWidth,
      recomputeHeight: this.recomputeHeight
    };
    // 先布局 normal 类型的元素
    this._layoutNormalItems(items, recompute);

    // 开始布局 region 相关元素
    // 为了锁紧先保存一下当前的布局空间
    const layoutTemp: LayoutSideType = {
      left: this.leftCurrent,
      top: this.topCurrent,
      right: this.rightCurrent,
      bottom: this.bottomCurrent
    };
    // 计算3d轴
    const absoluteItem = items.filter(x => x.layoutType === 'absolute');
    const zItems = absoluteItem.filter(i => {
      return i.layoutOrient === 'z';
    });

    // 计算z的宽高，让出一部分位置
    let extraWH = { width: 0, height: 0 };
    if (zItems.length) {
      const layoutRect = zItems[0].getLayoutRect();
      extraWH = layoutRect;
    }
    this.leftCurrent += extraWH.width / 8;
    this.rightCurrent -= extraWH.width / 8;
    this.topCurrent += extraWH.height / 8;
    this.bottomCurrent -= extraWH.height / 8;

    const { regionItems, relativeItems, relativeOverlapItems, allRelatives, overlapItems } = this._groupItems(items);
    // 有元素开启了自动缩进
    // TODO:目前只有普通占位布局下的 region-relative 元素支持
    // 主要考虑常规元素超出画布一般为用户个性设置，而且可以设置padding规避裁剪,不需要使用自动缩进
    this.layoutRegionItems(regionItems, relativeItems, relativeOverlapItems, overlapItems, recompute);

    // 缩进
    this._processAutoIndent(
      regionItems,
      relativeItems,
      relativeOverlapItems,
      overlapItems,
      allRelatives,
      layoutTemp,
      recompute
    );

    // z轴以外的绝对定位
    const absoluteItemExceptZAxis = absoluteItem.filter(i => i.layoutOrient !== 'z');
    this.layoutAbsoluteItems(absoluteItemExceptZAxis);

    // 找到x轴
    const xAxis = relativeItems.filter(item => {
      return item.model.specKey === 'axes' && isXAxis(item.layoutOrient);
    })[0];
    const yAxis = relativeItems.filter(item => {
      return item.model.specKey === 'axes' && isYAxis(item.layoutOrient);
    })[0];
    if (xAxis && zItems.length) {
      const sp = xAxis.getLayoutStartPoint();
      const lr = xAxis.getLayoutRect();
      const zRect = {
        x: yAxis.layoutOrient === 'left' ? sp.x + lr.width : sp.x,
        y: sp.y,
        width: this._chartLayoutRect.width,
        height: this._chartLayoutRect.height
      };
      (zItems[0].model as IAxis).directionStr = yAxis.layoutOrient === 'left' ? 'r2l' : 'l2r';
      // 将长宽高信息传给所有的轴
      const xRect = xAxis.getLayoutRect();
      const yRect = yAxis.getLayoutRect();
      // const zRect = zItems[0].getLayoutRect();
      const box3d = {
        length: zItems[0].getLayoutRect().width,
        width: xRect.width,
        height: yRect.height
      };

      (<any>xAxis.model).setLayout3dBox && (<any>xAxis.model).setLayout3dBox(box3d);
      (<any>yAxis.model).setLayout3dBox && (<any>yAxis.model).setLayout3dBox(box3d);
      (<any>zItems[0].model).setLayout3dBox && (<any>zItems[0].model).setLayout3dBox(box3d);

      this.layoutZAxisItems(zItems, zRect);
    }
  }

  /**
   * 对z轴进行布局
   * @param zItems
   */
  protected layoutZAxisItems(zItems: ILayoutItem[], zRect: IRect) {
    zItems.forEach(item => {
      // 设置盒子
      item.absoluteLayoutInRect(zRect);
    });
  }

  /**
   * 工具方法 根据item属性获取给item提供的布局空间
   * @param item
   */
  getItemComputeLayoutRect(item: ILayoutItem, extraOffset?: IOffset) {
    if (!extraOffset) {
      extraOffset = { offsetLeft: 0, offsetRight: 0, offsetTop: 0, offsetBottom: 0 };
    }
    const result = {
      width:
        this.rightCurrent -
        this.leftCurrent -
        item.layoutPaddingLeft -
        item.layoutPaddingRight -
        (extraOffset.offsetLeft + extraOffset.offsetRight),
      height:
        this.bottomCurrent -
        this.topCurrent -
        item.layoutPaddingTop -
        item.layoutPaddingBottom -
        (extraOffset.offsetTop + extraOffset.offsetBottom)
    };
    return result;
  }

  protected _checkAutoIndent(items: ILayoutItem[]) {
    const result = {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0
    };
    const rightCurrent = this._chartViewBox.x2 - this._chartViewBox.x1 - this.rightCurrent;
    const bottomCurrent = this._chartViewBox.y2 - this._chartViewBox.y1 - this.bottomCurrent;
    items.forEach(i => {
      if (!i.getModelVisible() || !i.autoIndent) {
        return;
      }
      const vOrH = i.layoutOrient === 'left' || i.layoutOrient === 'right';
      const outer = i.getLastComputeOutBounds();
      if (vOrH) {
        result.top = Math.max(result.top, outer.y1 - this.topCurrent);
        result.bottom = Math.max(result.bottom, outer.y2 - bottomCurrent);
      } else {
        result.left = Math.max(result.left, outer.x1 - this.leftCurrent);
        result.right = Math.max(result.right, outer.x2 - rightCurrent);
      }
    });
    return result;
  }
}

export const registerLayout3d = () => {
  Factory.registerLayout(Layout3d.type, Layout3d);
};
