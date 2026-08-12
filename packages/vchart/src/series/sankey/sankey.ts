/* eslint-disable no-duplicate-imports */
import { CartesianSeries } from '../cartesian/cartesian';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { Datum, IRectMarkSpec, ILinkPathMarkSpec, IComposedTextMarkSpec, StringOrNumber } from '../../typings';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { registerFadeInOutAnimation } from '../../animation/config';
import { registerDataSetInstanceTransform } from '../../data/register';
import type { ISankeyOpt } from '../../data/transforms/sankey';
import { sankeyFormat, sankeyLayout, collectHierarchyField } from '../../data/transforms/sankey';
import { sankeyNodes } from '../../data/transforms/sankey-nodes';
import { sankeyLinks } from '../../data/transforms/sankey-links';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { DataView } from '@visactor/vdataset';
import { LayoutZIndex } from '../../constant/layout';
import { AttributeLevel } from '../../constant/attribute';
import { Event_Bubble_Level } from '../../constant/event';
import { SankeySeriesTooltipHelper } from './tooltip-helper';
import type { IBounds } from '@visactor/vutils';
import { Bounds, array, isNil, isValid, isNumber, isArray } from '@visactor/vutils';
import { registerSankeyAnimation } from './animation';
import type { ISankeySeriesSpec, SankeyLinkElement, ISankeyLabelSpec, ISankeyAnimationParams } from './interface';
import type { ExtendEventParam } from '../../event/interface';
import type { IMarkAnimateSpec } from '../../animation/spec';
import { ColorOrdinalScale } from '../../scale/color-ordinal-scale';
import { registerRectMark } from '../../mark/rect';
import { registerTextMark } from '../../mark/text';
import { registerLinkPathMark } from '../../mark/link-path';
import { sankeySeriesMark } from './constant';
import { flatten } from '../../data/transforms/flatten';
import type { SankeyNodeElement } from '@visactor/vlayouts';
import { Factory } from '../../core/factory';
import type { IGlyphMark, ILinkPathMark, IMark, IMarkGraphic, IRectMark, ITextMark } from '../../mark/interface';
import { TransformLevel } from '../../data/initialize';
import type { IBaseScale } from '@visactor/vscale';
import { addDataKey, initKeyMap } from '../../data/transforms/data-key';
import { SankeySeriesSpecTransformer } from './sankey-transformer';
import { getFormatFunction } from '../../component/util';
import type { ILabelSpec } from '../../component';
import { getDatumOfGraphic } from '../../util';
import { addRuntimeState } from '../../mark/utils/glyph';
import { sankey } from '../../theme/builtin/common/series/sankey';
import { addGraphicState, removeGraphicState } from '../../util/graphic-state';

export class SankeySeries<T extends ISankeySeriesSpec = ISankeySeriesSpec> extends CartesianSeries<T> {
  static readonly type: string = SeriesTypeEnum.sankey;
  type = SeriesTypeEnum.sankey;

  static readonly transformerConstructor = SankeySeriesSpecTransformer as any;
  readonly transformerConstructor = SankeySeriesSpecTransformer;

  static readonly mark: SeriesMarkMap = sankeySeriesMark;
  static readonly builtInTheme = { sankey };

  private _nodeMark: IRectMark;
  private _linkMark: ILinkPathMark;

  private _nodeLayoutZIndex = LayoutZIndex.Node;
  private _labelLayoutZIndex = LayoutZIndex.Label;

  protected _nodesSeriesData?: DataView;
  protected _linksSeriesData?: DataView;

  private _viewBox: IBounds = new Bounds();

  protected _categoryField!: string;
  private _colorScale: IBaseScale;
  private _nodeList: (string | number)[];
  private _needClear: boolean;

  get direction() {
    return this._spec.direction ?? 'horizontal';
  }
  getCategoryField() {
    return this._categoryField;
  }
  setCategoryField(f: string): string {
    this._categoryField = f;
    return this._categoryField;
  }

  protected _valueField!: string;
  getValueField() {
    return this._valueField;
  }
  setValueField(f: string): string {
    this._valueField = f;
    return this._valueField;
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this.setCategoryField(this._spec.categoryField);
    this.setValueField(this._spec.valueField);
    this.setSeriesField(this._spec.seriesField ?? this._spec.categoryField);
  }

  initData() {
    super.initData();
    const viewData = this.getViewData();
    const rawData = this.getRawData();

    if (rawData && viewData) {
      // 初始化桑基图数据
      registerDataSetInstanceTransform(this._dataSet, 'sankeyLayout', sankeyLayout);
      registerDataSetInstanceTransform(this._dataSet, 'sankeyFormat', sankeyFormat);

      rawData.transform(
        {
          type: 'sankeyFormat'
        },
        false
      );

      viewData.transform({
        type: 'sankeyLayout',
        options: () => ({
          view: () => {
            return {
              x0: this._viewBox.x1,
              x1: this._viewBox.x2,
              y0: this._viewBox.y1,
              y1: this._viewBox.y2
            };
          },
          sourceField: this._spec.sourceField,
          targetField: this._spec.targetField,
          valueField: this._spec.valueField,
          direction: this.direction,
          crossNodeAlign: this._spec.crossNodeAlign,
          nodeAlign: this._spec.nodeAlign ?? 'justify',
          nodeGap: this._spec.nodeGap ?? 8,
          nodeWidth: this._spec.nodeWidth ?? 10,
          linkWidth: this._spec.linkWidth,
          minStepWidth: this._spec.minStepWidth,
          minNodeHeight: this._spec.minNodeHeight ?? 4,
          maxNodeHeight: this._spec.maxNodeHeight,
          minLinkHeight: this._spec.minLinkHeight,
          maxLinkHeight: this._spec.maxLinkHeight,
          iterations: this._spec.iterations,
          nodeKey: this._spec.nodeKey,
          linkSortBy: this._spec.linkSortBy,
          nodeSortBy: this._spec.nodeSortBy,
          setNodeLayer: this._spec.setNodeLayer,
          dropIsolatedNode: this._spec.dropIsolatedNode,
          nodeHeight: this._spec.nodeHeight,
          linkHeight: this._spec.linkHeight,
          equalNodeHeight: this._spec.equalNodeHeight,
          linkOverlap: this._spec.linkOverlap,
          inverse: this._spec.inverse
        } as ISankeyOpt),
        level: TransformLevel.sankeyLayout
      });

      // 注册扁平化算法
      const { dataSet } = this._option;
      registerDataSetInstanceTransform(dataSet, 'sankeyNodes', sankeyNodes);
      registerDataSetInstanceTransform(dataSet, 'flatten', flatten);
      const nodesDataView = new DataView(dataSet, { name: `sankey-node-${this.id}-data` });
      nodesDataView.parse([this.getViewData()], {
        type: 'dataview'
      });
      nodesDataView.transform({
        type: 'sankeyNodes'
      });
      // sankeyNode进行扁平化处理(针对层级数据)
      nodesDataView.transform(
        {
          type: 'flatten',
          options: {
            callback: (node: SankeyNodeElement) => {
              if (node.datum) {
                const nodeData = node.datum[node.depth];
                return { ...node, ...nodeData };
              }
              return node;
            }
          }
        },
        false
      );

      nodesDataView.transform(
        {
          type: 'addVChartProperty',
          options: {
            beforeCall: initKeyMap.bind(this),
            call: addDataKey
          }
        },
        false
      );

      this._nodesSeriesData = nodesDataView;

      registerDataSetInstanceTransform(dataSet, 'sankeyLinks', sankeyLinks);
      const linksDataView = new DataView(dataSet, { name: `sankey-link-${this.id}-data` });
      linksDataView.parse([this.getViewData()], {
        type: 'dataview'
      });
      linksDataView.transform({
        type: 'sankeyLinks'
      });

      linksDataView.transform(
        {
          type: 'addVChartProperty',
          options: {
            beforeCall: initKeyMap.bind(this),
            call: addDataKey
          }
        },
        false
      );
      this._linksSeriesData = linksDataView;
    }
  }

  compileData() {
    super.compileData();

    this._linkMark?.compileData();
    this._nodeMark?.compileData();
  }

  initMark(): void {
    // 为了让sankey 正常的滚动，interactive 需要设置为true，不然在空白处会滚动不了
    this._rootMark.setMarkConfig({
      overflow: this._spec.overflow,
      interactive: !!this._spec.overflow
    });
    const nodeMark = this._createMark(SankeySeries.mark.node, {
      isSeriesMark: true,
      dataView: this._nodesSeriesData
    }) as IRectMark;
    if (nodeMark) {
      nodeMark.setMarkConfig({ zIndex: this._nodeLayoutZIndex });
      this._nodeMark = nodeMark;
    }

    const linkMark = this._createMark(SankeySeries.mark.link, {
      dataView: this._linksSeriesData
    }) as ILinkPathMark;
    if (linkMark) {
      this._linkMark = linkMark;
    }
  }

  protected _buildMarkAttributeContext() {
    super._buildMarkAttributeContext();

    this._markAttributeContext.valueToNode = this.valueToNode.bind(this);
    this._markAttributeContext.valueToLink = this.valueToLink.bind(this);
  }

  valueToNode(value: StringOrNumber | StringOrNumber[]) {
    const nodes = this._nodesSeriesData.latestData;
    const specifyValue = array(value)[0];
    return nodes && nodes.find((node: SankeyNodeElement) => node.key === specifyValue);
  }

  valueToLink(value: StringOrNumber | StringOrNumber[]) {
    const links = this._linksSeriesData.latestData;
    const specifyValue = array(value);

    return (
      links &&
      links.find(
        (link: SankeyLinkElement) => link && link.source === specifyValue[0] && link.target === specifyValue[1]
      )
    );
  }

  valueToPositionX(value: StringOrNumber | StringOrNumber[]) {
    const node = this.valueToNode(value);

    return node?.x0;
  }
  valueToPositionY(value: StringOrNumber | StringOrNumber[]) {
    const node = this.valueToNode(value);

    return node?.y0;
  }

  initMarkStyle(): void {
    this._initNodeMarkStyle();
    this._initLinkMarkStyle();
  }

  protected _initNodeMarkStyle() {
    const nodeMark = this._nodeMark;
    if (!nodeMark) {
      return;
    }

    this.setMarkStyle<IRectMarkSpec>(
      nodeMark,
      {
        x: (datum: Datum) => {
          return datum.x0;
        },
        x1: (datum: Datum) => datum.x1,
        y: (datum: Datum) => datum.y0,
        y1: (datum: Datum) => datum.y1
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Mark
    );

    this.setMarkStyle(
      nodeMark,
      {
        fill: this._spec.node.style?.fill ?? this._fillByNode
      },
      'normal',
      AttributeLevel.User_Mark
    );
  }

  protected _fillByNode = (datum: Datum) => {
    if (datum && datum.sourceRect && datum.targetRect) {
      return this._fillByLink(datum);
    }

    const fill = this._spec.node?.style?.fill;

    if (isValid(fill)) {
      return fill;
    } else if (isValid(this._spec.seriesField)) {
      const colorScale = this._option?.globalScale?.getScale('color');
      const nodeDatum = datum?.datum ? datum.datum : datum;

      return colorScale?.scale(nodeDatum?.[this._spec.seriesField]);
    }

    return this._colorScale?.scale(this._getNodeNameFromData(datum));
  };

  protected _fillByLink = (datum: Datum) => {
    const fill = this._spec.link?.style?.fill;

    if (fill) {
      return fill;
    } else if (isValid(this._spec.seriesField)) {
      const sourceNode = this._nodesSeriesData.latestData?.find((entry: any) => datum.source === entry.key);
      const nodeDatum = sourceNode?.datum;
      const colorScale = this._option?.globalScale?.getScale('color');

      return colorScale?.scale(nodeDatum?.[this._spec.seriesField]);
    }

    const sourceName = isNumber(datum.source) ? this.getNodeList()[datum.source] : datum.source;
    return this._colorScale?.scale(sourceName);
  };

  protected _initLinkMarkStyle() {
    const linkMark = this._linkMark;
    if (!linkMark) {
      return;
    }

    (linkMark as IGlyphMark).setGlyphConfig({
      direction: this.direction
    });

    this.setMarkStyle<ILinkPathMarkSpec>(
      linkMark,
      {
        x0: (datum: Datum) => datum.x0,
        x1: (datum: Datum) => datum.x1,
        y0: (datum: Datum) => datum.y0,
        y1: (datum: Datum) => datum.y1,
        thickness: (datum: Datum) => datum.thickness
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );

    this.setMarkStyle(
      linkMark,
      {
        fill: this._spec.link.style?.fill ?? this._fillByLink
      },
      'normal',
      AttributeLevel.User_Mark
    );
  }

  initLabelMarkStyle(labelMark: ITextMark, labelSpec: ILabelSpec) {
    if (!labelMark) {
      return;
    }
    const position = labelSpec.position;

    if (position && position.includes('inside')) {
      this.setMarkStyle<IComposedTextMarkSpec>(labelMark, {
        fill: '#ffffff',
        text: (datum: Datum) => this._createText(datum, labelSpec as ISankeyLabelSpec),
        maxLineWidth: (datum: Datum) => (labelSpec as ISankeyLabelSpec).limit ?? datum.x1 - datum.x0
      });
    } else {
      this.setMarkStyle<IComposedTextMarkSpec>(labelMark, {
        fill: this._fillByNode,
        text: (datum: Datum) => this._createText(datum, labelSpec as ISankeyLabelSpec),
        maxLineWidth: (labelSpec as ISankeyLabelSpec).limit
      });
    }

    labelMark.setMarkConfig({ zIndex: this._labelLayoutZIndex });
  }

  private _createText(datum: Datum, labelSpec: ISankeyLabelSpec) {
    if (isNil(datum) || isNil(datum.datum)) {
      return '';
    }
    let text = datum.datum[this._spec.categoryField] || '';
    const { formatMethod, formatter } = labelSpec || {};

    const { formatFunc, args } = getFormatFunction(formatMethod, formatter, text, datum.datum);
    if (formatFunc) {
      text = formatFunc(...args, { series: this });
    }
    return text;
  }

  initAnimation() {
    const animationParams: ISankeyAnimationParams = {
      direction: this.direction,
      growFrom: () =>
        this.direction === 'horizontal'
          ? this._xAxisHelper?.getScale(0).scale(0)
          : this._yAxisHelper?.getScale(0).scale(0)
    };
    const appearPreset = (this._spec?.animationAppear as IMarkAnimateSpec<string>)?.preset;
    if (this._nodeMark) {
      this._nodeMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('sankeyNode')?.(animationParams, appearPreset),
          userAnimationConfig(SeriesMarkNameEnum.node, this._spec, this._markAttributeContext)
        )
      );
    }
    if (this._linkMark) {
      this._linkMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('sankeyLinkPath')?.(animationParams, appearPreset),
          userAnimationConfig(SeriesMarkNameEnum.link, this._spec, this._markAttributeContext)
        )
      );
    }
  }

  protected initEvent(): void {
    super.initEvent();

    this._nodesSeriesData?.target.addListener('change', this.nodesSeriesDataUpdate.bind(this));
    this._linksSeriesData?.target.addListener('change', this.linksSeriesDataUpdate.bind(this));
    const emphasisSpec = this._spec.emphasis ?? ({} as T['emphasis']);
    // 没有关闭交互时，才增加这些交互事件
    if (this._option.disableTriggerEvent !== true) {
      if (emphasisSpec.enable && (emphasisSpec.effect === 'adjacency' || emphasisSpec.effect === 'related')) {
        const event = emphasisSpec.trigger === 'hover' ? 'pointerover' : 'pointerdown';

        this.event.on(event, { level: Event_Bubble_Level.chart }, this._handleEmphasisElement);
      }
    }
  }

  private nodesSeriesDataUpdate() {
    this._nodeMark.getData().updateData();

    this._nodeList = null;
    this._setNodeOrdinalColorScale();
  }

  private linksSeriesDataUpdate() {
    this._linkMark.getData().updateData();
  }

  protected _handleEmphasisElement = (params: ExtendEventParam) => {
    const emphasisSpec = this._spec.emphasis ?? ({} as T['emphasis']);

    const graphic = params.item;

    if (emphasisSpec.effect === 'adjacency') {
      if (graphic && params.mark === this._nodeMark) {
        this._handleNodeAdjacencyClick(graphic);
      } else if (graphic && params.mark === this._linkMark) {
        this._handleLinkAdjacencyClick(graphic);
      } else {
        this._handleClearEmpty();
      }
    } else if (emphasisSpec.effect === 'related') {
      if (graphic && params.mark === this._nodeMark) {
        this._handleNodeRelatedClick(graphic);
      } else if (graphic && params.mark === this._linkMark) {
        this._handleLinkRelatedClick(graphic);
      } else {
        this._handleClearEmpty();
      }
    }
  };

  protected _handleClearEmpty = () => {
    if (!this._needClear) {
      return;
    }

    const allNodeElements = this._nodeMark?.getGraphics();

    if (!allNodeElements || !allNodeElements.length) {
      return;
    }

    const allLinkElements = this._linkMark?.getGraphics();

    if (!allLinkElements || !allLinkElements.length) {
      return;
    }

    // const states = [STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE];

    allNodeElements.forEach(el => {
      removeGraphicState(el, [STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE]);
    });
    allLinkElements.forEach(el => {
      removeGraphicState(el, [STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE]);
    });

    this._needClear = false;
  };

  protected _handleNodeAdjacencyClick = (graphic: IMarkGraphic) => {
    const nodeDatum = getDatumOfGraphic(graphic) as Datum;
    const highlightNodes: string[] = [nodeDatum.key];

    if (this._linkMark) {
      const allLinkElements = this._linkMark.getGraphics();

      if (!allLinkElements || !allLinkElements.length) {
        return;
      }

      allLinkElements.forEach((linkEl: IMarkGraphic, i: number) => {
        const linkDatum = getDatumOfGraphic(linkEl) as Datum;

        if (linkDatum.source === nodeDatum.key) {
          // 下游link
          if (!highlightNodes.includes(linkDatum.target)) {
            highlightNodes.push(linkDatum.target);
          }

          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);
          addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, true); // 设置上用户配置选中状态
        } else if (linkDatum.target === nodeDatum.key) {
          // 上游link
          if (!highlightNodes.includes(linkDatum.source)) {
            highlightNodes.push(linkDatum.source);
          }

          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);
          addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, true); // 设置上用户配置选中状态
        } else {
          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS);
          addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE, true);
        }
      });
    }

    if (this._nodeMark) {
      this._highLightElements(this._nodeMark.getGraphics(), highlightNodes);
    }

    this._needClear = true;
  };

  protected _handleLinkAdjacencyClick = (graphic: IMarkGraphic) => {
    const curLinkDatum = getDatumOfGraphic(graphic) as Datum;
    const highlightNodes: string[] = [curLinkDatum.source, curLinkDatum.target];

    if (this._linkMark) {
      const allLinkElements = this._linkMark.getGraphics();
      if (!allLinkElements || !allLinkElements.length) {
        return;
      }
      allLinkElements.forEach(linkEl => {
        if (linkEl === graphic) {
          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);

          addRuntimeState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, { ratio: 1 });
        } else {
          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS);
          addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE, true);
        }
      });
    }

    if (this._nodeMark) {
      this._highLightElements(this._nodeMark.getGraphics(), highlightNodes);
    }

    this._needClear = true;
  };

  protected _handleNodeRelatedClick = (graphic: IMarkGraphic) => {
    const nodeDatum = getDatumOfGraphic(graphic) as Datum;
    const allNodeElements = this._nodeMark.getGraphics();

    if (!allNodeElements || !allNodeElements.length) {
      return;
    }

    const allLinkElements = this._linkMark.getGraphics();

    if (!allLinkElements || !allLinkElements.length) {
      return;
    }

    const father = (getDatumOfGraphic(allLinkElements[0]) as Datum)?.parents ? 'parents' : 'source';

    if (father === 'source') {
      // node-link 型数据
      const highlightNodes: string[] = [nodeDatum.key];
      const highlightLinks: string[] = [];

      allLinkElements.forEach((linkEl: IMarkGraphic, i: number) => {
        const linkDatum = getDatumOfGraphic(linkEl) as Datum;
        const father = linkDatum?.parents ? 'parents' : 'source';

        if (array(linkDatum[father]).includes(nodeDatum.key)) {
          // 下游link
          if (!highlightLinks.includes(linkDatum.key ?? linkDatum.index)) {
            highlightLinks.push(linkDatum.key ?? linkDatum.index);
          }
          if (!highlightNodes.includes(linkDatum.source)) {
            highlightNodes.push(linkDatum.source);
          }

          if (!highlightNodes.includes(linkDatum.target)) {
            highlightNodes.push(linkDatum.target);
            // 下游link的目标节点
            const targetNode = allNodeElements.find(nodeElement => {
              return nodeElement.data[0].key === linkDatum.target;
            });

            // 以下游link的目标节点为起点的links
            let targetNodeSourceLinks: any[] = targetNode.data[0].sourceLinks as any[];
            while (targetNodeSourceLinks?.length > 0) {
              const newTargetNodeSourceLinks: any[] = [];
              targetNodeSourceLinks.forEach((targetNodeSourceLinkDatum: any) => {
                if (!highlightLinks.includes(targetNodeSourceLinkDatum.key ?? targetNodeSourceLinkDatum.index)) {
                  highlightLinks.push(targetNodeSourceLinkDatum.key ?? targetNodeSourceLinkDatum.index);
                  // 该links的目标节点
                  if (!highlightNodes.includes(targetNodeSourceLinkDatum.target)) {
                    highlightNodes.push(targetNodeSourceLinkDatum.target);
                    const sourceNodeTemp = allNodeElements.find(nodeElement => {
                      return nodeElement.data[0].key === targetNodeSourceLinkDatum.target;
                    });
                    // 以该目标节点为起点的links
                    newTargetNodeSourceLinks.push(sourceNodeTemp.data[0].targetLinks as any[]);
                  } else {
                    return;
                  }
                } else {
                  return;
                }
              });
              targetNodeSourceLinks = newTargetNodeSourceLinks;
              return;
            }
          }
        } else if (linkDatum.target === nodeDatum.key) {
          // 上游link
          if (!highlightLinks.includes(linkDatum.key ?? linkDatum.index)) {
            highlightLinks.push(linkDatum.key ?? linkDatum.index);
          }
          if (!highlightNodes.includes(linkDatum.source)) {
            highlightNodes.push(linkDatum.source);
            const sourceNode = allNodeElements.find(nodeElement => {
              return nodeElement.data[0].key === linkDatum.source;
            });
            let sourceNodeTargetLinks: any[] = sourceNode.data[0].targetLinks as any;
            while (sourceNodeTargetLinks?.length > 0) {
              const newSourceNodeTargetLinks: any[] = [];
              sourceNodeTargetLinks.forEach((sourceNodeTargetLinkDatum: any) => {
                if (!highlightLinks.includes(sourceNodeTargetLinkDatum.key ?? sourceNodeTargetLinkDatum.index)) {
                  highlightLinks.push(sourceNodeTargetLinkDatum.key ?? sourceNodeTargetLinkDatum.index);
                  if (!highlightNodes.includes(sourceNodeTargetLinkDatum.source)) {
                    highlightNodes.push(sourceNodeTargetLinkDatum.source);
                    const sourceNodeTemp = allNodeElements.find(nodeElement => {
                      return nodeElement.data[0].key === sourceNodeTargetLinkDatum.source;
                    });
                    newSourceNodeTargetLinks.push(sourceNodeTemp.data[0].targetLinks as any[]);
                  } else {
                    return;
                  }
                } else {
                  return;
                }
              });
              sourceNodeTargetLinks = newSourceNodeTargetLinks;
              return;
            }
          }
        }
      });

      if (this._linkMark) {
        const allLinkElements = this._linkMark.getGraphics();

        if (!allLinkElements || !allLinkElements.length) {
          return;
        }

        allLinkElements.forEach((linkEl: IMarkGraphic, i: number) => {
          const linkDatum = getDatumOfGraphic(linkEl) as Datum;

          if (highlightLinks.includes(linkDatum.key ?? linkDatum.index)) {
            removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);
            addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, true);
          } else {
            removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS);
            addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE, true);
          }
        });
      }

      if (this._nodeMark) {
        this._highLightElements(this._nodeMark.getGraphics(), highlightNodes);
      }
    } else {
      // 层级型数据
      const highlightNodes: string[] = [nodeDatum.key];

      const upstreamLinks = nodeDatum.targetLinks.reduce((res: any[], link: any) => {
        const dividedLinks = array((link as any).datum);

        dividedLinks.forEach(dividedLink => {
          const parents = dividedLink.parents;
          const len = parents.length;

          for (let i = 0; i < len; i++) {
            const source = parents[i].key;
            const target = parents[i + 1] ? parents[i + 1].key : nodeDatum.key;
            const value = dividedLink.value;

            // 检查 res 数组中是否已存在相同的 source 和 target
            const existingItem = res.find(item => item.source === source && item.target === target);

            if (existingItem) {
              // 如果存在相同的项，则对其 value 进行累加
              existingItem.value += value;
            } else {
              // 如果不存在相同的项，则添加新的项到 res 数组中
              res.push({ source, target, value });
            }
          }
        });
        return res;
      }, []);

      allLinkElements.forEach((linkEl: IMarkGraphic, i: number) => {
        const linkDatum = getDatumOfGraphic(linkEl) as Datum;
        const originalDatum = linkDatum.datum;
        const selectedDatum = originalDatum
          ? originalDatum.filter((entry: any) => entry[father].some((par: any) => par.key === nodeDatum.key))
          : null;

        const upSelectedLink = upstreamLinks.find(
          (upLink: any) => upLink.source === linkDatum.source && upLink.target === linkDatum.target
        );

        if (selectedDatum && selectedDatum.length) {
          // 下游link
          if (!highlightNodes.includes(linkDatum.source)) {
            highlightNodes.push(linkDatum.source);
          }

          if (!highlightNodes.includes(linkDatum.target)) {
            highlightNodes.push(linkDatum.target);
          }

          const val = selectedDatum.reduce((sum: number, d: any) => {
            return (sum += d.value);
          }, 0);
          const ratio = val / linkDatum.value;

          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);

          addRuntimeState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, { ratio });

          return;
        }

        if (upSelectedLink) {
          // 上游link
          if (!highlightNodes.includes(linkDatum.source)) {
            highlightNodes.push(linkDatum.source);
          }

          if (!highlightNodes.includes(linkDatum.target)) {
            highlightNodes.push(linkDatum.target);
          }

          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);

          addRuntimeState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, {
            ratio: upSelectedLink.value / linkDatum.value
          }); // 设置默认的部分高亮

          return;
        }

        removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS);
        addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE, true);

        return;
      });

      if (this._nodeMark) {
        this._highLightElements(this._nodeMark.getGraphics(), highlightNodes);
      }
    }

    this._needClear = true;
  };

  protected _handleLinkRelatedClick = (graphic: IMarkGraphic) => {
    const allNodeElements = this._nodeMark.getGraphics();

    if (!allNodeElements || !allNodeElements.length) {
      return;
    }
    const allLinkElements = this._linkMark.getGraphics();

    if (!allLinkElements || !allLinkElements.length) {
      return;
    }

    const father = (getDatumOfGraphic(graphic) as Datum) ? 'parents' : 'source';
    if (father === 'source') {
      // const states = [STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE];
      if (this._linkMark) {
        allLinkElements.forEach(linkEl => {
          removeGraphicState(linkEl, [
            STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS,
            STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE
          ]);
        });
      }

      if (this._nodeMark) {
        allNodeElements.forEach(el => {
          removeGraphicState(el, [
            STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS,
            STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE
          ]);
        });
      }
    } else {
      const curLinkDatum = getDatumOfGraphic(graphic) as Datum;
      const highlightNodes: string[] = [curLinkDatum.source, curLinkDatum.target];
      const upstreamLinks: Array<{ source: string; target: string; value: number }> = [];

      const dividedLinks = array((curLinkDatum as any).datum);

      dividedLinks.forEach(dividedLink => {
        const parents = (dividedLink as any).parents;
        const len = parents.length;
        for (let i = 0; i < len - 1; i++) {
          const source = parents[i].key;
          const target = parents[i + 1].key;
          const value = dividedLink.value;

          // 检查 upstreamLinks 数组中是否已存在相同的 source 和 target
          const existingItem = upstreamLinks.find(item => item.source === source && item.target === target);
          upstreamLinks.push({
            source: parents[i].key,
            target: parents[i + 1].key,
            value: dividedLink.value
          });

          if (existingItem) {
            // 如果存在相同的项，则对其 value 进行累加
            existingItem.value += value;
          } else {
            // 如果不存在相同的项，则添加新的项到 upstreamLinks 数组中
            upstreamLinks.push({ source, target, value });
          }
        }
      });

      allLinkElements.forEach(linkEl => {
        const linkDatum = getDatumOfGraphic(linkEl) as Datum;
        const originalDatum = linkDatum.datum;

        if (linkDatum.source === curLinkDatum.source && linkDatum.target === curLinkDatum.target) {
          // 自身
          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);
          addRuntimeState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, { ratio: 1 });

          return;
        }

        const selectedDatum = originalDatum
          ? originalDatum.filter((entry: any) => {
              const parentKeysList = entry.parents.map((item: any) => item.key);
              return parentKeysList.includes(curLinkDatum.source) && parentKeysList.includes(curLinkDatum.target);
            })
          : null;

        if (selectedDatum && selectedDatum.length) {
          // 下游link
          if (!highlightNodes.includes(linkDatum.source)) {
            highlightNodes.push(linkDatum.source);
          }

          if (!highlightNodes.includes(linkDatum.target)) {
            highlightNodes.push(linkDatum.target);
          }

          const val = selectedDatum
            .filter((entry: any) => {
              return entry.parents.some((par: any, index: number) => {
                return par.key === curLinkDatum.source && entry.parents[index + 1]?.key === curLinkDatum.target;
              });
            })
            .reduce((sum: number, d: any) => {
              return (sum += d.value);
            }, 0);
          const ratio = val / linkDatum.value;

          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);

          addRuntimeState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, { ratio }); // 设置默认的部分高亮

          return;
        }

        const upSelectedLink = upstreamLinks.find(
          (upLink: any) => upLink.source === linkDatum.source && upLink.target === linkDatum.target
        );

        if (upSelectedLink) {
          // 点击节点的上游一层的节点
          if (!highlightNodes.includes(linkDatum.source)) {
            highlightNodes.push(linkDatum.source);
          }
          if (!highlightNodes.includes(linkDatum.target)) {
            highlightNodes.push(linkDatum.target);
          }
          removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE);

          addRuntimeState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, {
            ratio: upSelectedLink.value / (linkDatum as Datum).value
          }); // 设置默认的部分高亮

          return;
        }
        removeGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS);
        addGraphicState(linkEl, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE, true);

        return;
      });

      this._highLightElements(allNodeElements, highlightNodes);
    }

    this._needClear = true;
  };

  protected _highLightElements(graphics: IMarkGraphic[], highlightNodes: string[]) {
    if (!graphics || !graphics.length) {
      return;
    }

    graphics.forEach(g => {
      removeGraphicState(g, [STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS]);

      if (highlightNodes.includes((getDatumOfGraphic(g) as Datum).key)) {
        addGraphicState(g, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS, true);
      } else {
        addGraphicState(g, STATE_VALUE_ENUM.STATE_SANKEY_EMPHASIS_REVERSE, true);
      }
    });
  }

  protected initTooltip() {
    this._tooltipHelper = new SankeySeriesTooltipHelper(this);
    this._nodeMark && this._tooltipHelper.activeTriggerSet.mark.add(this._nodeMark);
    this._linkMark && this._tooltipHelper.activeTriggerSet.mark.add(this._linkMark);
  }

  _setNodeOrdinalColorScale() {
    const colorScale = this._option?.globalScale?.getScale('color');

    if ((colorScale as any)?._specified) {
      this._colorScale = colorScale;
      return;
    }

    let colorDomain: string[];
    let colorRange: string[];

    if (colorScale) {
      colorDomain = colorScale.domain();
      colorRange = colorScale.range();
    }

    if (!colorRange) {
      colorRange = this._getDataScheme() as unknown as string[];
    }

    if (!colorDomain || isNil(colorDomain[0])) {
      // no validate domain
      colorDomain = this.getNodeList();

      if (colorDomain && colorDomain.length > 10) {
        colorRange = (this._getDataScheme()[1] as any)?.scheme;
      }
    }

    const ordinalScale = new ColorOrdinalScale();

    ordinalScale.domain(colorDomain).range?.(colorRange);

    this._colorScale = ordinalScale;
    return;
  }

  getNodeList() {
    if (this._nodeList) {
      return this._nodeList;
    }

    const data = this._rawData.latestData[0];

    const nodeList = data?.nodes
      ? data.nodes[0]?.children
        ? Array.from(this.extractNamesFromTree(data.nodes, this._spec.categoryField))
        : data.nodes.map((datum: Datum, index: number) => {
            return datum[this._spec.categoryField];
          })
      : data?.links
      ? Array.from(this.extractNamesFromLink(data.links))
      : data?.values?.map((datum: Datum, index: number) => {
          return datum[this._spec.categoryField];
        });

    this._nodeList = nodeList;

    return nodeList;
  }

  _getNodeNameFromData(datum: Datum) {
    return datum?.datum ? datum.datum[this._spec.categoryField] : datum.key ?? datum[this._spec.categoryField];
  }

  extractNamesFromTree(tree: any, categoryName: string) {
    // Set 用于存储唯一的 name 值
    const uniqueNames = new Set();

    // 遍历当前节点的子节点
    tree.forEach((node: any) => {
      // 将当前节点的 name 值添加到 Set 中
      uniqueNames.add(node[categoryName]);

      // 如果当前节点还有子节点，则递归调用该函数继续遍历子节点
      if (node.children) {
        const childNames = this.extractNamesFromTree(node.children, categoryName);
        childNames.forEach(name => uniqueNames.add(name));
      }
    });

    return uniqueNames;
  }

  extractNamesFromLink(links: any[]) {
    // Set 用于存储唯一的 name 值
    const uniqueNames = new Set();
    const { sourceField, targetField } = this._spec;

    // 遍历所有的边
    links.forEach((link: any) => {
      isValid(link[sourceField]) && uniqueNames.add(link[sourceField]);
      isValid(link[targetField]) && uniqueNames.add(link[targetField]);
    });

    return uniqueNames;
  }

  getDimensionField() {
    return [this._spec.categoryField];
  }

  getMeasureField(): string[] {
    return [this._valueField];
  }

  getRawDataStatisticsByField(field: string, isNumeric?: boolean) {
    // overwrite the getRawDataStatisticsByField of base-series
    if (!this._rawStatisticsCache) {
      this._rawStatisticsCache = {};
    }

    if (!this._rawStatisticsCache[field]) {
      const canUseViewStatistics = this._viewDataStatistics && this.getViewData().transformsArr.length <= 1;

      if (canUseViewStatistics && this._viewDataStatistics.latestData?.[field]) {
        this._rawStatisticsCache[field] = this._viewDataStatistics.latestData[field];
      } else if (this._rawData) {
        this._rawStatisticsCache[field] = {
          values: this._collectByField(field)
        };
      }
    }

    return this._rawStatisticsCache[field];
  }

  private _collectByField(field: string): string[] {
    const keyArray: any[] = [];
    const rawData = this.getRawData()?.latestData?.[0];

    if (!rawData) {
      return [];
    }

    if ((rawData as any).links) {
      //node-link型数据
      if ((rawData as any).nodes?.length) {
        (rawData as any).nodes.forEach((node: any) => {
          if (node[this._seriesField]) {
            keyArray.push(node[this._seriesField]);
          }
        });
      }
    } else if ((rawData as any).nodes) {
      const set = new Set<string>();
      // 层级型数据
      collectHierarchyField(set, (rawData as any).nodes, this._seriesField);

      return Array.from(set);
    }

    return keyArray;
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    this._viewBox.set(0, 0, this._region.getLayoutRect().width, this._region.getLayoutRect().height);

    // calculate the sankeyLayout
    this.getViewData().reRunAllTransform();
  }

  getDefaultShapeType(): string {
    return 'square';
  }

  // make sure this function fast
  protected _noAnimationDataKey(datum: Datum, index: number): unknown | undefined {
    return undefined;
  }

  getActiveMarks(): IMark[] {
    return [this._nodeMark, this._linkMark];
  }

  getMarkData(datum: Datum) {
    if (datum.datum) {
      if (isArray(datum.datum)) {
        return datum.datum[datum.datum.length - 1];
      }
      return datum.datum;
    }
    return datum;
  }
}

export const registerSankeySeries = () => {
  registerRectMark();
  registerLinkPathMark();
  registerTextMark();
  registerSankeyAnimation();
  registerFadeInOutAnimation();
  Factory.registerSeries(SankeySeries.type, SankeySeries);
};
