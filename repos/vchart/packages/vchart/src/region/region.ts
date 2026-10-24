// eslint-disable-next-line no-duplicate-imports
import { isEmpty, isEqual, array, isValid } from '@visactor/vutils';
import { MarkTypeEnum } from '../mark/interface/type';
import type { ISeries } from '../series/interface';
import type { IModelOption } from '../model/interface';
import type { CoordinateType } from '../typings/coordinate';
import type { IGeoRegionSpec, IRegion, IRegionSpec, IRegionSpecInfo } from './interface';
import { ChartEvent } from '../constant/event';
import { LayoutZIndex } from '../constant/layout';
import { AttributeLevel } from '../constant/attribute';
import type { ILayoutType, StringOrNumber } from '../typings';
import { LayoutModel } from '../model/layout-model';
import { RegionSpecTransformer } from './region-transformer';
import type { IGroupMark, IRectMark } from '../mark/interface/mark';
import type { IGroup } from '@visactor/vrender-core';

export class Region<T extends IRegionSpec = IRegionSpec> extends LayoutModel<T> implements IRegion {
  static type = 'region';
  static readonly transformerConstructor = RegionSpecTransformer;
  readonly transformerConstructor = RegionSpecTransformer as any;
  readonly modelType: string = 'region';
  static specKey = 'region';
  specKey: string = 'region';

  type = Region.type;
  protected _series: ISeries[] = [];
  layoutType: ILayoutType = 'region';
  layoutZIndex: number = LayoutZIndex.Region;

  declare getSpecInfo: () => IRegionSpecInfo;

  getMaxWidth() {
    return this._layout.maxWidth;
  }
  setMaxWidth(value: number) {
    this._layout.maxWidth = value;
  }

  getMaxHeight() {
    return this._layout.maxHeight;
  }
  setMaxHeight(value: number) {
    this._layout.maxHeight = value;
  }

  protected _groupMark!: IGroupMark;
  getGroupMark() {
    return this._groupMark;
  }

  protected _interactionMark!: IGroupMark;
  getInteractionMark() {
    return this._interactionMark;
  }

  getStackInverse() {
    return this._spec.stackInverse === true;
  }

  getStackSort() {
    return this._spec.stackSort === true;
  }

  protected _backgroundMark?: IRectMark;
  protected _foregroundMark?: IRectMark;

  constructor(spec: T, ctx: IModelOption) {
    super(spec, ctx);
    this.userId = spec.id;
    this.coordinate = spec.coordinate ?? 'cartesian';
  }

  protected _getClipDefaultValue() {
    const chartSpec = this._option.getChart().getSpec();
    const hasDataZoom = (chartSpec as any).dataZoom?.some?.((entry: any) => {
      const filterMode = entry.filterMode ?? 'filter';
      return filterMode === 'axis';
    });
    const hasScrollBar = (chartSpec as any).scrollBar?.some?.((entry: any) => {
      const filterMode = entry.filterMode ?? 'axis';
      return filterMode === 'axis';
    });

    return hasDataZoom || hasScrollBar ? true : this._layout.layoutClip;
  }

  created(): void {
    this.initLayout();
    super.created();
    const clip = this._spec.clip ?? this._getClipDefaultValue();
    this._groupMark = this._createGroupMark('regionGroup', this.userId, this.layoutZIndex);

    if ((this._spec as IGeoRegionSpec).roam) {
      this._groupMark.setMarkConfig({ interactive: true });
    }

    // 交互层
    this._interactionMark = this._createGroupMark(
      'regionInteractionGroup',
      (this.userId ?? this.type) + '_interaction',
      LayoutZIndex.Interaction
    );

    // hack: region 的样式不能设置在groupMark上，因为groupMark目前没有计算dirtyBound，会导致拖影问题
    if (!isEmpty(this._spec.style)) {
      this._backgroundMark = this._createMark(
        { type: MarkTypeEnum.rect, name: 'regionBackground' },
        {
          parent: this._groupMark
        }
      ) as IRectMark;
      if (clip) {
        this._foregroundMark = this._createMark(
          { type: MarkTypeEnum.rect, name: 'regionForeground' },
          {
            parent: this._groupMark
          }
        ) as IRectMark;
      }
      [this._backgroundMark, this._foregroundMark].forEach(mark => {
        if (mark) {
          mark.created();
          this.setMarkStyle(
            mark,
            {
              width: () => this.getLayoutRect().width,
              height: () => this.getLayoutRect().height
            },
            'normal',
            AttributeLevel.Built_In
          );
          this._groupMark.addMark(mark);
        }
      });
      this._backgroundMark && this._backgroundMark.setMarkConfig({ zIndex: LayoutZIndex.SeriesGroup - 1 });
      this._foregroundMark && this._foregroundMark.setMarkConfig({ zIndex: LayoutZIndex.Mark + 1 });
    }
  }

  private _createGroupMark(name: string, userId: StringOrNumber, zIndex: number) {
    const groupMark = this._createMark({ type: MarkTypeEnum.group, name }) as IGroupMark;
    groupMark.setUserId(userId);
    groupMark.setMarkConfig({ zIndex });
    const clip = this._spec.clip ?? this._getClipDefaultValue();
    this.setMarkStyle(
      groupMark,
      {
        x: () => this.getLayoutStartPoint().x,
        y: () => this.getLayoutStartPoint().y,
        width: () => this.getLayoutRect().width,
        height: () => this.getLayoutRect().height,
        clip
      },
      'normal',
      AttributeLevel.Built_In
    );
    this.setMarkStyle(
      groupMark,
      {
        cornerRadius: this._spec.style?.cornerRadius
      },
      'normal',
      AttributeLevel.User_Mark
    );

    this._marks.addMark(groupMark);
    return groupMark;
  }

  init(option: any) {
    super.init(option);
    this.initMark();
    this.initSeriesDataflow();
  }
  initMark() {
    this._initBackgroundMarkStyle();
    this._initForegroundMarkStyle();
  }

  protected _initBackgroundMarkStyle() {
    if (this._backgroundMark) {
      this.setMarkStyle(
        this._backgroundMark,
        {
          fillOpacity: this._spec.style?.fill ? 1 : 0,
          ...this._spec.style
        },
        'normal',
        AttributeLevel.User_Mark
      );
      if (this._spec.clip ?? this._getClipDefaultValue()) {
        this.setMarkStyle(
          this._backgroundMark,
          {
            strokeOpacity: 0
          },
          'normal',
          AttributeLevel.Built_In
        );
      }
    }
  }

  protected _initForegroundMarkStyle() {
    if (this._foregroundMark) {
      this.setMarkStyle(
        this._foregroundMark,
        {
          ...this._spec.style,
          fillOpacity: 0,
          pickable: false
        },
        'normal',
        AttributeLevel.User_Mark
      );
    }
  }

  _compareSpec(spec: T, prevSpec: T) {
    const result = super._compareSpec(spec, prevSpec);
    if (!isEqual(prevSpec?.style, spec?.style)) {
      result.reMake = true;
    }
    return result;
  }

  reInit(spec?: T) {
    super.reInit(spec);
    this._initBackgroundMarkStyle();
    this._initForegroundMarkStyle();
  }

  addSeries(s: ISeries) {
    if (!s) {
      return;
    }
    if (!this._series.includes(s)) {
      this._series.push(s);
    }
  }

  removeSeries(s: ISeries) {
    if (!s) {
      return;
    }
    const index = this._series.findIndex(s_ => s_ === s);
    if (index >= 0) {
      this._series.splice(index, 1);
    }
  }

  getSeries(
    opt: {
      name?: string;
      userId?: StringOrNumber | StringOrNumber[];
      specIndex?: number | number[];
      id?: StringOrNumber;
      type?: string;
      coordinateType?: CoordinateType;
      dataName?: string;
    } = {}
  ): ISeries[] {
    return this._series.filter(
      s =>
        (opt.name ? s?.name === opt.name : true) &&
        (opt.userId ? array(opt.userId).includes(s.userId) : true) &&
        (isValid(opt.specIndex) ? array(opt.specIndex).includes(s.getSpecIndex()) : true) &&
        (opt.id ? s.id === opt.id : true) &&
        (opt.type ? s.type === opt.type : true) &&
        (opt.coordinateType ? s.coordinate === opt.coordinateType : true) &&
        (opt.dataName ? s.getRawData?.()?.name === opt.dataName : true)
    );
  }

  getSeriesInName(name: string): ISeries {
    return this.getSeries({ name })[0];
  }
  getSeriesInUserId(userId: string): ISeries {
    return this.getSeries({ userId })[0];
  }
  getSeriesInId(id: number): ISeries {
    return this.getSeries({ id })[0];
  }
  getSeriesInType(type: string): ISeries[] {
    return this.getSeries({ type });
  }
  getSeriesInCoordinateType(coordinateType: CoordinateType): ISeries[] {
    return this.getSeries({ coordinateType });
  }
  getSeriesInDataName(dataName: string): ISeries[] {
    return this.getSeries({ dataName });
  }

  initSeriesDataflow() {
    const viewDataFilters = this._series.map(s => s.getViewDataFilter() ?? s.getViewData()).filter(v => !!v);
    this._option.dataSet.multipleDataViewAddListener(viewDataFilters, 'change', this.seriesDataFilterOver);
  }

  seriesDataFilterOver = () => {
    this.event.emit(ChartEvent.regionSeriesDataFilterOver, { model: this, chart: this.getChart() });
    this._series.forEach(s => {
      if (s.getViewDataFilter()) {
        s.reTransformViewData();
      }
    });
  };

  release() {
    super.release();
    this._series = [];
  }

  compileMarks(group?: IGroup) {
    this.getMarks().forEach(m => {
      m.compile({ group, context: { model: this } });
      // m.layout(
      //   (group: IVGrammarGroupMark, children: IMark[], parentLayoutBounds: IBoundsLike, options?: ILayoutOptions) => {
      //     // console.log('region mark layout');
      //   }
      // );
    });
  }

  compile() {
    this.compileMarks();
  }

  getBoundsInRect = () => {
    return {
      x1: this._layout.getLayoutStartPoint().x,
      y1: this._layout.getLayoutStartPoint().y,
      x2: this._layout.getLayoutStartPoint().x + this._layout.getLayoutRect().width,
      y2: this._layout.getLayoutStartPoint().y + this._layout.getLayoutRect().height
    };
  };

  onLayoutEnd(): void {
    this._series.forEach(s => s.onLayoutEnd());
    super.onLayoutEnd();
  }
}
