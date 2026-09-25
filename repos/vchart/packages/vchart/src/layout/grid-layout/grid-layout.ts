import type { utilFunctionCtx } from '../../typings/params';
import type { IChart } from '../../chart/interface/chart';
import type { IBoundsLike } from '@visactor/vutils';
import type { IBaseLayout, IGridLayoutSpec, ElementSpec, ILayoutItem } from '../interface';
import { isFunction, isValid, isValidNumber } from '@visactor/vutils';
import type { IRect } from '../../typings/space';
import { Factory } from '../../core/factory';

type GridSize = {
  value: number;
  isUserSetting: boolean;
  isLayoutSetting: boolean;
};

export class GridLayout implements IBaseLayout {
  static type = 'grid';
  private _chartLayoutRect: IRect = { x: 0, y: 0, width: 1, height: 1 };
  private _chartViewBox: IBoundsLike;

  protected _col: number = 1;
  protected _row: number = 1;
  protected _colSize: GridSize[];
  protected _rowSize: GridSize[];

  protected _colElements: ILayoutItem[][];
  protected _rowElements: ILayoutItem[][];

  protected _gridInfo: IGridLayoutSpec;

  protected _elementMap: Map<ILayoutItem, ElementSpec> = new Map();

  protected _onError: (...args: any[]) => void;

  constructor(gridInfo: IGridLayoutSpec, ctx: utilFunctionCtx) {
    this.standardizationSpec(gridInfo);
    this._gridInfo = gridInfo;
    this._col = gridInfo.col;
    this._row = gridInfo.row;
    this._colSize = new Array(this._col).fill(null);
    this._rowSize = new Array(this._row).fill(null);
    this._colElements = new Array(this._col).fill([]);
    this._rowElements = new Array(this._row).fill([]);
    this._onError = ctx?.onError;

    this.initUserSetting();
  }

  protected standardizationSpec(gridInfo: IGridLayoutSpec) {
    gridInfo.col = gridInfo.col ?? 1;
    gridInfo.row = gridInfo.row ?? 1;
    gridInfo.elements = gridInfo.elements ?? [];
  }

  protected initUserSetting() {
    // 先对用户设置的宽高进行设置
    this._gridInfo.colWidth &&
      this.setSizeFromUserSetting(this._gridInfo.colWidth, this._colSize, this._col, this._chartLayoutRect.width);

    this._gridInfo.rowHeight &&
      this.setSizeFromUserSetting(this._gridInfo.rowHeight, this._rowSize, this._row, this._chartLayoutRect.height);
    // 其余位置默认填充0
    this._colSize.forEach((c, i) => {
      if (!c) {
        this._colSize[i] = {
          value: 0,
          isUserSetting: false,
          isLayoutSetting: false
        };
      }
    });
    this._rowSize.forEach((r, i) => {
      if (!r) {
        this._rowSize[i] = {
          value: 0,
          isUserSetting: false,
          isLayoutSetting: false
        };
      }
    });
  }

  /**
   * 设置用户设置的 colWidth 和 rowHeight
   */
  protected setSizeFromUserSetting(
    userSetting: {
      index: number;
      size: number | ((maxSize: number) => number);
    }[],
    gridSize: GridSize[],
    gridMax: number,
    maxSize: number
  ) {
    userSetting.forEach(userSet => {
      if (userSet.index < 0 && userSet.index >= gridMax) {
        return;
      }
      if (isValidNumber(userSet.size)) {
        gridSize[userSet.index] = {
          value: +userSet.size,
          isUserSetting: true,
          isLayoutSetting: false
        };
      } else if (isFunction(userSet.size)) {
        gridSize[userSet.index] = {
          value: userSet.size(maxSize),
          isUserSetting: true,
          isLayoutSetting: false
        };
      }
    });
  }

  protected clearLayoutSize() {
    // 先对用户设置的宽高进行设置
    this._gridInfo.colWidth &&
      this.setSizeFromUserSetting(this._gridInfo.colWidth, this._colSize, this._col, this._chartLayoutRect.width);

    this._gridInfo.rowHeight &&
      this.setSizeFromUserSetting(this._gridInfo.rowHeight, this._rowSize, this._row, this._chartLayoutRect.height);

    // 其余位置默认填充0
    this._colSize.forEach(c => {
      c.isLayoutSetting = false;
      if (!c.isUserSetting) {
        c.value = 0;
      }
    });
    this._rowSize.forEach(r => {
      r.isLayoutSetting = false;
      if (!r.isUserSetting) {
        r.value = 0;
      }
    });
  }

  protected getItemGridInfo(item: ILayoutItem): ElementSpec {
    // map 中寻找
    const mapResult = this._elementMap.get(item);
    if (mapResult) {
      return mapResult;
    }
    // 配置中匹配
    let result: ElementSpec | undefined;
    result = this._gridInfo.elements?.find(e => {
      if ('modelId' in e && isValid(e.modelId)) {
        if (isValid(item.model.userId) && item.model.userId === e.modelId) {
          return true;
        }
      } else if ('modelKey' in e && isValid(e.modelKey) && 'modelIndex' in e && isValid(e.modelIndex)) {
        const specKey = item.model.specKey ?? item.model.type;
        if (specKey === e.modelKey && item.model.getSpecIndex() === e.modelIndex) {
          return true;
        }
      }
      return false;
    });
    // default
    if (!result) {
      result = {
        col: 0,
        colSpan: 1,
        row: 0,
        rowSpan: 1
      } as ElementSpec;
    }
    this._elementMap.set(item, result);
    return result;
  }

  protected getSizeFromGrid(spec: ElementSpec, type: 'col' | 'row'): number | undefined {
    const sizeList = type === 'col' ? this._colSize : this._rowSize;
    let result = 0;
    for (let index = spec[type]; index < spec[type] + (spec[`${type}Span`] ?? 1); index++) {
      result += sizeList[index].value;
    }
    return result;
  }

  protected getSizeFromUser(spec: ElementSpec, type: 'col' | 'row'): number | undefined {
    const sizeList = type === 'col' ? this._colSize : this._rowSize;
    if (!sizeList[spec[type]]?.isUserSetting) {
      return undefined;
    }
    let result = 0;
    for (let index = spec[type]; index < spec[type] + (spec[`${type}Span`] ?? 1); index++) {
      if (!sizeList[index].isUserSetting) {
        return undefined;
      }
      result += sizeList[index].value;
    }
    return result;
  }

  protected setItemLayoutSizeToGrid(item: ILayoutItem, gridSpec: ElementSpec) {
    if (isColItem(item)) {
      if (gridSpec.colSpan && gridSpec.colSpan > 1) {
        return;
      }
      if (this._colSize[gridSpec.col].isUserSetting) {
        return;
      }
      this._colSize[gridSpec.col].value = Math.max(
        this._colSize[gridSpec.col].value,
        item.getLayoutRect().width + item.layoutPaddingLeft + item.layoutPaddingRight
      );
      this._colSize[gridSpec.col].isLayoutSetting = true;
    } else {
      if (gridSpec.rowSpan && gridSpec.rowSpan > 1) {
        return;
      }
      if (this._rowSize[gridSpec.row].isUserSetting) {
        return;
      }
      this._rowSize[gridSpec.row].value = Math.max(
        this._rowSize[gridSpec.row].value,
        item.getLayoutRect().height + item.layoutPaddingTop + item.layoutPaddingBottom
      );
      this._rowSize[gridSpec.row].isLayoutSetting = true;
    }
  }

  protected layoutGrid(type: 'col' | 'row') {
    const gridSize = type === 'col' ? this._colSize : this._rowSize;
    let unSetSize = type === 'col' ? this._chartLayoutRect.width : this._chartLayoutRect.height;
    const willSize: GridSize[] = [];
    gridSize.forEach(s => {
      if (s.isUserSetting || s.isLayoutSetting) {
        unSetSize -= s.value;
      } else {
        willSize.push(s);
      }
    });
    if (unSetSize < 0) {
      console.warn(`layout content ${type} size bigger than chart`);
    }
    willSize.forEach(s => (s.value = unSetSize / willSize.length));
  }

  protected getItemPosition(item: ILayoutItem) {
    const gridSpec = this.getItemGridInfo(item);
    const point = { x: this._chartLayoutRect.x, y: this._chartLayoutRect.y };
    for (let col = 0; col < gridSpec.col; col++) {
      point.x += this._colSize[col].value;
    }
    for (let row = 0; row < gridSpec.row; row++) {
      point.y += this._rowSize[row].value;
    }
    point.x += item.layoutPaddingLeft + item.layoutOffsetX;
    point.y += item.layoutPaddingTop + item.layoutOffsetY;
    return point;
  }

  protected getItemLayoutRect(item: ILayoutItem) {
    const gridSpec = this.getItemGridInfo(item);
    // 先设置空间
    const rect = {
      width:
        (this.getSizeFromGrid(gridSpec, 'col') ?? this._chartLayoutRect.width) -
        item.layoutPaddingLeft -
        item.layoutPaddingRight,
      height:
        (this.getSizeFromGrid(gridSpec, 'row') ?? this._chartLayoutRect.height) -
        item.layoutPaddingTop -
        item.layoutPaddingBottom
    };
    return rect;
  }

  layoutItems(_chart: IChart, items: ILayoutItem[], chartLayoutRect: IRect, chartViewBox: IBoundsLike): void {
    this._chartLayoutRect = chartLayoutRect;
    this._chartViewBox = chartViewBox;
    // 先清空旧布局信息
    this.clearLayoutSize();
    // 越大越先处理，进行排序调整，利用原地排序特性，排序会受 level 和传进来的数组顺序共同影响
    items.sort((a, b) => b.layoutLevel - a.layoutLevel);

    // 剔除 region 后，其余元素先布局运算
    const normalItems = items.filter(item => item.layoutType === 'normal' && item.getModelVisible() !== false);
    const normalItemsCol = normalItems.filter(item => isColItem(item));
    const normalItemsRow = normalItems.filter(item => !isColItem(item));
    normalItems.forEach(item => {
      this.layoutOneItem(item, 'user', false);
    });

    // region 和 region 关联元素
    const regionsRelative = items.filter(x => x.layoutType === 'region-relative');
    const regionsRelativeCol = regionsRelative.filter(item => isColItem(item));
    const regionsRelativeRow = regionsRelative.filter(item => !isColItem(item));
    // 先进行 col 方向布局
    regionsRelativeCol.forEach(item => this.layoutOneItem(item, 'user', false));
    // 然后得到最终 col 信息 此时已经是最终 col 信息
    this.layoutGrid('col');
    // 再使用宽度信息辅助row方向排序
    // 此时普通占位元素，会因为布局宽度影响最终布局高度
    normalItemsRow.forEach(item => this.layoutOneItem(item, 'colGrid', false));
    regionsRelativeRow.forEach(item => {
      this.layoutOneItem(item, 'colGrid', false);
    });
    // 然后得到最终 row 信息
    this.layoutGrid('row');
    // 统一水平方向元素高度
    regionsRelativeRow.forEach(item => {
      this.layoutOneItem(item, 'grid', false);
    });
    // 再使用宽度信息，第二次次对 col 方向布局
    normalItemsCol.forEach(item => this.layoutOneItem(item, 'grid', false));
    regionsRelativeCol.forEach(item => {
      // 此时从布局逻辑可知，item的layoutRect会发生，将item的layoutTag设置为true
      this.layoutOneItem(item, 'grid', true);
    });
    this.layoutGrid('col');

    // region
    items.filter(x => x.layoutType === 'region').forEach(item => this.layoutOneItem(item, 'grid', false));

    // 再找出 absolute 元素，无需排序，在 compiler 层需要排序放置
    this.layoutAbsoluteItems(items.filter(x => x.layoutType === 'absolute'));

    // 最后基于grid 设置位置
    items
      .filter(x => x.layoutType !== 'absolute')
      .forEach(item => {
        item.setLayoutStartPosition(this.getItemPosition(item));
      });
  }

  /**
   *
   * 无需排序，在 compiler 层需要排序放置
   *
   * 重要：absolute 默认依据 region 进行相对依赖
   */

  private layoutAbsoluteItems(absoluteItems: ILayoutItem[]) {
    absoluteItems.forEach(item => {
      // 设置盒子
      item.absoluteLayoutInRect(this._chartLayoutRect);
    });
  }

  protected layoutOneItem(item: ILayoutItem, sizeType: 'user' | 'grid' | 'colGrid' | 'rowGrid', ignoreTag: boolean) {
    const sizeCallRow =
      sizeType === 'rowGrid' || sizeType === 'grid' ? this.getSizeFromGrid.bind(this) : this.getSizeFromUser.bind(this);
    const sizeCallCol =
      sizeType === 'colGrid' || sizeType === 'grid' ? this.getSizeFromGrid.bind(this) : this.getSizeFromUser.bind(this);
    // 先获取 item 的 grid 信息
    const gridSpec = this.getItemGridInfo(item);
    // 先设置空间
    const computeRect = {
      width:
        (sizeCallCol(gridSpec, 'col') ?? this._chartLayoutRect.width) -
        item.layoutPaddingLeft -
        item.layoutPaddingRight,
      height:
        (sizeCallRow(gridSpec, 'row') ?? this._chartLayoutRect.height) -
        item.layoutPaddingTop -
        item.layoutPaddingBottom
    };
    const rect = item.computeBoundsInRect(computeRect);
    if (!isValidNumber(rect.width)) {
      rect.width = computeRect.width;
    }
    if (!isValidNumber(rect.height)) {
      rect.height = computeRect.height;
    }
    item.setLayoutRect(sizeType !== 'grid' ? rect : computeRect);
    // 设置大小到grid
    this.setItemLayoutSizeToGrid(item, gridSpec);
  }
}

function isColItem(item: ILayoutItem) {
  return item.layoutOrient === 'left' || item.layoutOrient === 'right';
}

export const registerGridLayout = () => {
  Factory.registerLayout(GridLayout.type, GridLayout);
};
