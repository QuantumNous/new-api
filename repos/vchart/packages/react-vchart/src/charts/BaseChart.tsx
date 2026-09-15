import type {
  IVChart,
  IData,
  IInitOption,
  ISpec,
  IVChartConstructor,
  IHierarchyData,
  IVChartRenderOption
} from '@visactor/vchart';
import type { ReactNode } from 'react';
import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import type { ContainerProps } from '../containers/withContainer';
import withContainer from '../containers/withContainer';
import type { ChartContextType } from '../context/chart';
import RootChartContext from '../context/chart';
import { isEqual, isNil, isValid, pickWithout } from '@visactor/vutils';
import { toArray } from '../util';
import { REACT_PRIVATE_PROPS } from '../constants';
import type {
  EventsProps,
  LegendEventProps,
  ScrollBarEventProps,
  BrushEventProps,
  DataZoomEventProps,
  PlayerEventProps,
  DimensionEventProps,
  HierarchyEventProps,
  ChartLifeCycleEventProps
} from '../eventsUtils';
import { bindEventsToChart, CHART_EVENTS_KEYS, CHART_EVENTS } from '../eventsUtils';
import type { IReactTooltipProps } from '../components/tooltip/interface';
import { initCustomTooltip } from '../components/tooltip/util';

export type ChartOptions = Omit<IInitOption, 'dom'>;

export interface BaseChartProps
  extends EventsProps,
    LegendEventProps,
    ScrollBarEventProps,
    BrushEventProps,
    DataZoomEventProps,
    PlayerEventProps,
    DimensionEventProps,
    HierarchyEventProps,
    ChartLifeCycleEventProps,
    IReactTooltipProps,
    ContainerProps {
  vchartConstructor?: IVChartConstructor;
  /**  @deprecated 请使用 vchartConstructor  */
  vchartConstrouctor?: IVChartConstructor;
  type?: string;
  /** 上层container */
  container?: HTMLDivElement;
  /**
   * used only by <VChart />
   */
  spec?: ISpec;
  /** 数据 */
  data?: IData | IHierarchyData;
  /** 画布宽度 */
  width?: number;
  /** 画布高度 */
  height?: number;
  /** 图表配置 */
  options?: ChartOptions;
  /** skip function diff when component update */
  skipFunctionDiff?: boolean;
  /**
   * add `morphConfig` for chart
   * @since 1.12.7
   */
  morphConfig?: IVChartRenderOption['morphConfig'];
  /** 图表渲染完成事件 */
  onReady?: (instance: IVChart, isInitial: boolean) => void;
  /** throw error when chart run into an error */
  onError?: (err: Error) => void;
  /**
   * use sync render
   *
   * @since 1.8.3
   * @deprecated 1.9.0
   **/
  useSyncRender?: boolean;
}

type Props = React.PropsWithChildren<BaseChartProps>;

const notSpecKeys = [
  ...REACT_PRIVATE_PROPS,
  ...CHART_EVENTS_KEYS,
  'vchartConstructor',
  'vchartConstrouctor',
  'useSyncRender',
  'skipFunctionDiff',
  'onError',
  'onReady',
  'spec',
  'container',
  'options',
  'morphConfig'
];
const defaultMorphConfig = {
  morph: false,
  enableExitAnimation: false
};

const getComponentId = (child: React.ReactNode, index: number) => {
  const componentName = child && (child as any).type && ((child as any).type.displayName || (child as any).type.name);
  return `${componentName}-${index}`;
};

const parseSpecFromChildren = (props: Props) => {
  const specFromChildren: Omit<ISpec, 'type' | 'data' | 'width' | 'height'> = {};

  toArray(props.children).map((child, index) => {
    const parseSpec = child && (child as any).type && (child as any).type.parseSpec;

    if (parseSpec && (child as any).props) {
      const childProps = isNil((child as any).props.componentId)
        ? {
            ...(child as any).props,
            componentId: getComponentId(child, index)
          }
        : (child as any).props;

      const specResult = parseSpec(childProps);

      if (specResult.isSingle) {
        (specFromChildren as any)[specResult.specName] = specResult.spec;
      } else {
        if (!(specFromChildren as any)[specResult.specName]) {
          (specFromChildren as any)[specResult.specName] = [];
        }

        (specFromChildren as any)[specResult.specName].push(specResult.spec);
      }
    }
  });

  return specFromChildren;
};

const BaseChart: React.FC<Props> = React.forwardRef((props, ref) => {
  const [updateId, setUpdateId] = useState<number>(0);
  const chartContext = useRef<ChartContextType>({});
  useImperativeHandle(ref, () => chartContext.current?.chart);
  const hasSpec = !!props.spec;
  const isUnmount = useRef<boolean>(false);
  const prevSpec = useRef(pickWithout(props, notSpecKeys));
  const specFromChildren = useRef<Omit<ISpec, 'type' | 'data' | 'width' | 'height'>>(null);
  const eventsBinded = React.useRef<BaseChartProps>(null);
  const skipFunctionDiff = !!props.skipFunctionDiff;
  const [tooltipNode, setTooltipNode] = useState<ReactNode>(null);

  const parseSpec = (props: Props) => {
    let spec: ISpec;

    if (hasSpec && props.spec) {
      spec = props.spec;

      if (isValid(props.data)) {
        spec = {
          ...props.spec,
          data: props.data
        } as ISpec;
      }
    } else {
      spec = {
        ...prevSpec.current,
        ...specFromChildren.current
      } as ISpec;
    }

    const tooltipSpec = initCustomTooltip(setTooltipNode, props, spec.tooltip);
    if (tooltipSpec) {
      spec.tooltip = tooltipSpec;
    }
    return spec;
  };

  const createChart = (props: Props) => {
    const cs = new (props.vchartConstructor ?? (props as any).vchartConstrouctor)(parseSpec(props), {
      ...props.options,
      onError: props.onError,
      autoFit: true,
      dom: props.container
    });
    chartContext.current = { ...chartContext.current, chart: cs };
    isUnmount.current = false;
  };

  const handleChartRender = (rebindEvent?: boolean) => {
    // rebind events after render
    if (!isUnmount.current) {
      if (!chartContext.current || !chartContext.current.chart) {
        return;
      }

      if (rebindEvent) {
        bindEventsToChart(chartContext.current.chart, props, eventsBinded.current, CHART_EVENTS);
      }

      setUpdateId(updateId + 1);
      if (props.onReady) {
        props.onReady(chartContext.current.chart, updateId === 0);
      }
    }
  };

  const renderChart = () => {
    if (chartContext.current.chart) {
      // event should bind before render when the chart has not been rendered
      bindEventsToChart(chartContext.current.chart, props, eventsBinded.current, CHART_EVENTS);

      chartContext.current.chart.renderSync({
        reuse: false
      });
      handleChartRender();
    }
  };

  useEffect(() => {
    const newSpecFromChildren = hasSpec ? null : parseSpecFromChildren(props);

    if (!chartContext.current?.chart) {
      if (!hasSpec) {
        specFromChildren.current = newSpecFromChildren;
      }

      createChart(props);
      renderChart();
      eventsBinded.current = props;
      return;
    }

    if (hasSpec) {
      if (!isEqual(eventsBinded.current.spec, props.spec, { skipFunction: skipFunctionDiff })) {
        chartContext.current.chart.updateSpecSync(parseSpec(props), undefined, props.morphConfig ?? defaultMorphConfig);
        handleChartRender(true);
        eventsBinded.current = props;
      } else if (eventsBinded.current.data !== props.data) {
        chartContext.current.chart.updateFullDataSync(props.data as any);
        handleChartRender(true);
        eventsBinded.current = props;
      }
      return;
    }

    const newSpec = pickWithout(props, notSpecKeys);

    if (
      !isEqual(newSpec, prevSpec.current, { skipFunction: skipFunctionDiff }) ||
      !isEqual(newSpecFromChildren, specFromChildren.current, { skipFunction: skipFunctionDiff })
    ) {
      prevSpec.current = newSpec;
      specFromChildren.current = newSpecFromChildren;

      chartContext.current.chart.updateSpecSync(parseSpec(props), undefined, props.morphConfig ?? defaultMorphConfig);
      handleChartRender(true);
      eventsBinded.current = props;
    }
  }, [props]);

  useEffect(() => {
    return () => {
      if (chartContext) {
        if (chartContext.current && chartContext.current.chart) {
          chartContext.current.chart.release();
          chartContext.current.chart = null;
        }
      }
      eventsBinded.current = null;
      isUnmount.current = true;
    };
  }, []);

  return (
    <RootChartContext.Provider value={chartContext.current}>
      {toArray(props.children).map((child, index) => {
        if (typeof child === 'string') {
          return null;
        }

        const childId = getComponentId(child, index);

        return (
          <React.Fragment key={childId}>
            {React.cloneElement(child as React.ReactElement<any, React.JSXElementConstructor<any>>, {
              updateId: updateId,
              componentId: childId
            })}
          </React.Fragment>
        );
      })}
      {tooltipNode}
    </RootChartContext.Provider>
  );
});

export const createChart = <T extends Props>(
  componentName: string,
  defaultProps?: Partial<T>,
  registers?: (() => void)[]
) => {
  if (registers && registers.length && defaultProps.vchartConstructor) {
    defaultProps.vchartConstructor.useRegisters(registers);
  }

  const Com = withContainer<T>(BaseChart as any, componentName, (props: T) => {
    if (defaultProps) {
      return Object.assign(props, defaultProps);
    }
    return props;
  });
  Com.displayName = componentName;
  return Com;
};
