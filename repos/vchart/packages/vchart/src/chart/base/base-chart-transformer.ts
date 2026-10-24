import { isArray, isNumber, isValid } from '@visactor/vutils';
import type { IChartSpec, ISeriesSpec } from '../../typings';
import type { IChartSpecInfo, IChartSpecTransformer, IChartSpecTransformerOption } from '../interface';
import type { IModelConstructor, IModelSpecInfo } from '../../model/interface';
import type { IRegionConstructor, RegionSpec } from '../../region/interface';
import { Factory } from '../../core';
import type { ISeriesConstructor } from '../../series';
import type { IComponentConstructor } from '../../component/interface/common';
import { ComponentTypeEnum } from '../../component/interface';
import { setProperty } from '@visactor/vutils-extension';
import { getRelatedRegionInfo, getRelatedSeriesInfo } from './util';
import type { ICartesianBandAxisSpec } from '../..//component/axis/cartesian/interface';
import { array } from '../../util';
import { getSpecInfo } from '../../component/util';

const DEFAULT_SERIES_RELATED_CHART_SPEC_KEYS: Record<string, true> = {
  series: true,
  label: true,
  animationAppear: true,
  animationEnter: true,
  animationUpdate: true,
  animationExit: true,
  animationNormal: true
};

export class BaseChartSpecTransformer<T extends IChartSpec> implements IChartSpecTransformer {
  readonly type: string;
  readonly seriesType: string;
  protected _seriesRelatedSpecKeys: Record<string, true> = { ...DEFAULT_SERIES_RELATED_CHART_SPEC_KEYS };

  protected _option: IChartSpecTransformerOption;

  constructor(option: IChartSpecTransformerOption) {
    this._option = option;
    this.type = option.type;
    this.seriesType = option.seriesType;
  }

  /** 此方法不建议重写 */
  initChartSpec(chartSpec: T): IChartSpecInfo {
    this.transformSpec(chartSpec);
    return this.transformModelSpec(chartSpec);
  }

  /**
   * 转换 chart spec。包含以下步骤：
   * - 将图表 spec 统一转换为 common 图表 spec
   * - 图表层级的在初始化阶段的 spec 修改
   */
  transformSpec(chartSpec: T): void {
    if (!chartSpec.region || chartSpec.region.length === 0) {
      chartSpec.region = [{}];
    }
    if (chartSpec.tooltip === undefined) {
      chartSpec.tooltip = {};
    }
    // 堆积逆序
    if (isValid(chartSpec.stackInverse)) {
      chartSpec.region.forEach((r: RegionSpec) => {
        !isValid(r.stackInverse) && (r.stackInverse = chartSpec.stackInverse);
      });
    }
    // 堆积排序
    if (isValid(chartSpec.stackSort)) {
      chartSpec.region.forEach((r: RegionSpec) => {
        !isValid(r.stackSort) && (r.stackSort = chartSpec.stackSort);
      });
    }
  }

  generateTransform(chartSpec: T, isRuntime?: boolean) {
    return (constructor: IModelConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => {
      const { spec, specPath, specInfoPath, type } = specInfo;
      const transformer = new constructor.transformerConstructor({
        ...this._option,
        type
      });
      // 调用 model 自己的 transformer 进行转换
      const transformResult = transformer.transformSpec(spec, chartSpec, chartSpecInfo);
      const chartSpecInfoValue = {
        ...specInfo,
        ...transformResult
      };
      if (isRuntime) {
        chartSpecInfoValue.theme = transformer.getTheme(spec, chartSpec);
      } else {
        setProperty(chartSpec, specPath, transformResult.spec);
      }
      setProperty(chartSpecInfo, specInfoPath ?? specPath, chartSpecInfoValue);
    };
  }

  /**
   * 转换 model spec。包含以下步骤：
   * - model 层级的主题合并
   * - model 层级的在初始化阶段的 spec 修改，如添加 label spec
   */
  transformModelSpec(chartSpec: T): IChartSpecInfo {
    return this.createSpecInfo(chartSpec, this.generateTransform(chartSpec, false));
  }

  /** 遍历图表 spec 中包含的所有的 model，进行 spec 转换并生成图表 spec info */
  createSpecInfo(
    chartSpec: T,
    transform?: (
      /** 当前 model 的类 */
      constructor: IModelConstructor,
      /** 当前 model 的 spec info */
      specInfo: IModelSpecInfo,
      /** 图表 spec info */
      chartSpecInfo?: IChartSpecInfo
    ) => void
  ): IChartSpecInfo {
    if (!transform) {
      transform = this.generateTransform(chartSpec, true);
    }

    const currentChartSpecInfo: IChartSpecInfo = {};

    /* 预处理 region */
    this.forEachRegionInSpec(chartSpec, transform, currentChartSpecInfo);

    /* 预处理 series */
    this.forEachSeriesInSpec(chartSpec, transform, currentChartSpecInfo);
    // 记录每个 series 关联的 region
    currentChartSpecInfo.series?.forEach((seriesSpecInfo, i) => {
      const relatedRegion =
        getRelatedRegionInfo(seriesSpecInfo, currentChartSpecInfo) ?? currentChartSpecInfo.region ?? [];
      const region = relatedRegion[0];
      if (region) {
        if (!region.seriesIndexes) {
          region.seriesIndexes = [];
        }
        region.seriesIndexes.push(i);
        seriesSpecInfo.regionIndexes = region.regionIndexes.slice();
      }
    });

    /* 预处理 component */
    this.forEachComponentInSpec(chartSpec, transform, currentChartSpecInfo);
    // 记录每个 component 关联的 region、series
    Object.values(currentChartSpecInfo.component ?? {}).forEach(specInfoList =>
      specInfoList.forEach((componentSpecInfo, i) => {
        if (!componentSpecInfo) {
          return;
        }
        if (!componentSpecInfo.regionIndexes) {
          const relatedRegion =
            getRelatedRegionInfo(componentSpecInfo, currentChartSpecInfo) ?? currentChartSpecInfo.region ?? [];
          componentSpecInfo.regionIndexes = relatedRegion.map(region => region.regionIndexes[0]);
        }
        if (!componentSpecInfo.seriesIndexes) {
          const seriesInfo = getRelatedSeriesInfo(componentSpecInfo, currentChartSpecInfo);
          if (!seriesInfo) {
            const seriesIndexSet = new Set<number>();
            (componentSpecInfo.regionIndexes ?? []).forEach(regionIndex => {
              const region = currentChartSpecInfo.region?.[regionIndex];
              region?.seriesIndexes?.forEach(seriesIndex => seriesIndexSet.add(seriesIndex));
            });
            componentSpecInfo.seriesIndexes = Array.from(seriesIndexSet);
          } else {
            componentSpecInfo.seriesIndexes = seriesInfo.map(({ seriesIndexes }) => seriesIndexes[0]);
          }
        }
      })
    );
    return currentChartSpecInfo;
  }

  protected _isValidSeries(seriesType: string): boolean {
    return true;
  }

  getSeriesRelatedSpecKeys(): Record<string, true> {
    return this._seriesRelatedSpecKeys;
  }

  protected _addSeriesRelatedSpecKeys(...keysList: Array<string[] | undefined>) {
    keysList.forEach(keys => {
      keys?.forEach(key => {
        this._seriesRelatedSpecKeys[key] = true;
      });
    });
  }

  protected _getDefaultSeriesSpec(chartSpec: any, pickKeys?: string[], pickKeys2?: string[]) {
    this._addSeriesRelatedSpecKeys(pickKeys, pickKeys2);

    const series: any = {
      dataKey: chartSpec.dataKey,

      hover: chartSpec.hover,
      select: chartSpec.select,

      label: chartSpec.label,

      seriesStyle: chartSpec.seriesStyle,

      animation: chartSpec.animation ?? this._option.globalInstance?.isAnimationEnable(),
      animationThreshold: chartSpec.animationThreshold ?? this._option.getTheme?.('animationThreshold'),
      animationAppear: chartSpec.animationAppear,
      animationDisappear: chartSpec.animationDisappear,
      animationEnter: chartSpec.animationEnter,
      animationUpdate: chartSpec.animationUpdate,
      animationExit: chartSpec.animationExit,
      animationNormal: chartSpec.animationNormal,
      animationState: chartSpec.animationState,

      extensionMark: chartSpec.extensionMark,

      large: chartSpec.large,
      largeThreshold: chartSpec.largeThreshold,
      progressiveStep: chartSpec.progressiveStep,
      progressiveThreshold: chartSpec.progressiveThreshold,
      background: chartSpec.seriesBackground,

      invalidType: chartSpec.invalidType,

      seriesField: chartSpec.seriesField,

      morph: chartSpec.morph,

      interactions: chartSpec.interactions
    };

    const seriesType = this.seriesType;
    if (seriesType) {
      this._addSeriesRelatedSpecKeys([seriesType]);
      series.type = seriesType;
      series[seriesType] = (chartSpec as any)[seriesType];
    }

    if (pickKeys && pickKeys.length) {
      pickKeys.forEach(k => {
        series[k] = chartSpec[k];
      });
    }
    if (pickKeys2 && pickKeys2.length) {
      pickKeys2.forEach(k => {
        series[k] = chartSpec[k];
      });
    }
    return series;
  }

  /** 遍历 spec 中每个有效的 region */
  forEachRegionInSpec<K>(
    chartSpec: T,
    callbackfn: (constructor: IRegionConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K,
    chartSpecInfo?: IChartSpecInfo
  ): K[] {
    const regionSpec = (chartSpec.region as RegionSpec[]) ?? [];
    return regionSpec.map((spec, index) =>
      callbackfn(
        Factory.getRegionInType('region'),
        {
          spec,
          specPath: ['region', index],
          type: 'region',
          regionIndexes: [index]
        },
        chartSpecInfo
      )
    );
  }

  /** 遍历 spec 中每个有效的 series */
  forEachSeriesInSpec<K>(
    chartSpec: T,
    callbackfn: (constructor: ISeriesConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K,
    chartSpecInfo?: IChartSpecInfo
  ): K[] {
    const seriesSpec = (chartSpec.series as ISeriesSpec[]) ?? [];
    return seriesSpec.map((spec, index) =>
      callbackfn(
        Factory.getSeriesInType(spec.type),
        {
          spec,
          specPath: ['series', index],
          type: spec.type,
          seriesIndexes: [index]
        },
        chartSpecInfo
      )
    );
  }

  /** 遍历 spec 中每个有效的 component */
  forEachComponentInSpec<K>(
    chartSpec: T,
    callbackfn: (constructor: IComponentConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K,
    chartSpecInfo?: IChartSpecInfo
  ): K[] {
    const results: K[] = [];
    const components = Factory.getComponents();

    // 坐标轴组件只需要调用一次
    let cartesianAxis: IComponentConstructor;
    let polarAxis: IComponentConstructor;
    let geoCoordinate: IComponentConstructor;
    let tooltip: IComponentConstructor;
    const otherComponents = [];

    for (let index = 0; index < components.length; index++) {
      const { cmp, alwaysCheck } = components[index];
      if (cmp.type.startsWith(ComponentTypeEnum.cartesianAxis)) {
        cartesianAxis = cmp;
      } else if (cmp.type.startsWith(ComponentTypeEnum.polarAxis)) {
        polarAxis = cmp;
      } else if (cmp.type === ComponentTypeEnum.geoCoordinate) {
        geoCoordinate = cmp;
      } else if (alwaysCheck || (chartSpec as any)[cmp.specKey ?? cmp.type]) {
        if (cmp.type === ComponentTypeEnum.tooltip) {
          tooltip = cmp;
        } else {
          otherComponents.push(components[index]);
        }
      }
    }

    // NOTE: 坐标轴组件需要在其他组件之前创建
    let hasInitAxis = false;
    if (cartesianAxis) {
      const infoList = cartesianAxis.getSpecInfo(chartSpec, chartSpecInfo);
      if (infoList?.length > 0) {
        hasInitAxis = true;
        infoList.forEach(info => {
          const cmp = Factory.getComponentInKey(info.type);
          results.push(callbackfn(cmp, info, chartSpecInfo));
        });
      }
    }

    if (polarAxis && !hasInitAxis) {
      const infoList = polarAxis.getSpecInfo(chartSpec, chartSpecInfo);
      if (infoList?.length > 0) {
        hasInitAxis = true;
        infoList.forEach(info => {
          const cmp = Factory.getComponentInKey(info.type);
          results.push(callbackfn(cmp, info, chartSpecInfo));
        });
      }
    }

    if (geoCoordinate && !hasInitAxis) {
      geoCoordinate.getSpecInfo(chartSpec, chartSpecInfo)?.forEach(info => {
        results.push(callbackfn(geoCoordinate, info, chartSpecInfo));
      });
    }

    otherComponents.sort((a, b) => {
      return a.createOrder - b.createOrder;
    });

    otherComponents.forEach(({ cmp: C }) => {
      (C.getSpecInfo ? C.getSpecInfo(chartSpec, chartSpecInfo) : getSpecInfo(chartSpec, C.specKey, C.type))?.forEach(
        info => {
          results.push(callbackfn(C, info, chartSpecInfo));
        }
      );
    });

    // NOTE: tooltip 组件需要在 crosshair 组件之后创建
    if (tooltip) {
      getSpecInfo(chartSpec, tooltip.specKey, tooltip.type)?.forEach(info => {
        results.push(callbackfn(tooltip, info, chartSpecInfo));
      });
    }

    return results;
  }

  /** 处理series配置 */
  transformSeriesSpec(spec: T): void {
    const defaultSeriesSpec = this._getDefaultSeriesSpec(spec);
    if (!spec.series || spec.series.length === 0) {
      spec.series = [defaultSeriesSpec];
    } else {
      spec.series.forEach(s => {
        if (!this._isValidSeries(s.type)) {
          return;
        }
        Object.keys(defaultSeriesSpec).forEach(k => {
          if (!(k in s)) {
            (s as any)[k] = defaultSeriesSpec[k];
          }
        });
      });
    }
  }

  protected _findBandAxisBySeries(seriesSpec: ISeriesSpec, seriesIndex: number, axesSpec: any) {
    const isHorizontal = (seriesSpec as any)?.direction === 'horizontal';
    const matchOrient = isHorizontal ? ['left', 'right'] : ['top', 'bottom'];
    const targetBandAxis: any = axesSpec.find((axis: any) => {
      if (!matchOrient.includes(axis.orient)) {
        // orient必须匹配
        return false;
      }
      if (isValid(axis.seriesId)) {
        // 1. 通过seriesId绑定
        if (array(axis.seriesId).includes(seriesSpec?.id)) {
          return true;
        }
      } else if (isValid(axis.seriesIndex)) {
        // 2. 通过seriesIndex绑定
        if (array(axis.seriesIndex).includes(seriesIndex)) {
          return true;
        }
      } else if (axis.type === 'band') {
        // 3. 通过axis type识别
        return true;
      }
      // 4. 剩下的情况满足axis orient要求
      return true;
    });

    return targetBandAxis;
  }

  /**
   * @description bar chart 和 common chart支持autoBandsize, 此方法用于识别barWidth配置后应用到轴上
   * */
  protected _applyAxisBandSize(
    axis: ICartesianBandAxisSpec,
    extend: number,
    barWidthSpec: {
      barMaxWidth: number | string;
      barMinWidth: number | string;
      barWidth: number | string;
      barGapInGroup: number | string | (number | string)[];
    }
  ) {
    const { barMaxWidth, barMinWidth, barWidth, barGapInGroup } = barWidthSpec;
    let hasBarWidth = false;
    if (isNumber(barMinWidth)) {
      axis.minBandSize = barMinWidth as number;
      hasBarWidth = true;
    } else if (isNumber(barWidth)) {
      axis.minBandSize = barWidth as number;
      hasBarWidth = true;
    } else if (isNumber(barMaxWidth)) {
      axis.minBandSize = barMaxWidth as number;
      hasBarWidth = true;
    }
    if (hasBarWidth) {
      axis.bandSizeLevel = Number.MAX_VALUE; // 影响最底层的 scale
      axis.bandSizeExtend = {
        extend,
        gap: isArray(barGapInGroup) ? barGapInGroup[(barGapInGroup as any[]).length - 1] : barGapInGroup
      };
    }
  }
}
