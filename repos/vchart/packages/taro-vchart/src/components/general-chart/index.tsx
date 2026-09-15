import React from 'react';
import { View, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  TTCanvas,
  style_cs_canvas,
  style_cs_canvas_hidden,
  style_cs_tooltip_canvas,
  style_container
} from '../../utils';

import { IChartProps, IVChart, IDomRef, RenderMode } from '../../typings';

export interface GeneralChartProps extends IChartProps {
  /**
   * vchart 的环境参数
   */
  mode?: RenderMode;
}

export class GeneralChart extends React.Component<GeneralChartProps> {
  ttCanvas: TTCanvas;

  async componentDidMount() {
    if (!this.props.chartConstructor) {
      console.error('props.chartConstructor is not found');
    }
    if (!this.props.spec || !this.props.canvasId) {
      if (!this.props.spec) console.warn('props.spec are not found');
      if (!this.props.canvasId) console.warn('props.canvasId are not found');
      return;
    }

    // 获取domRef
    const getDomRef = async () => {
      return new Promise<IDomRef>(resolve => {
        Taro.nextTick(() => {
          Taro.createSelectorQuery()
            .select(`#${this.props.canvasId}_draw_canvas`)
            .boundingClientRect(domref => {
              resolve(domref as any as IDomRef);
            })
            .exec();
        });
      });
    };

    /**
     * TODO:
     * 这里是一个很不优雅的写法
     * 具体背景为: 用户在加载页面后, 立刻创建图表, 会报取不domRef的错误.
     * 具体原因是Taro.nextTick()仅执行一次时, 在飞书小程序无法正确取到Dom节点. 经过测试, 调用2次就可以保持正确.
     * 因此在这里被迫做了一个for循环, 多次尝试. 至多取100次.
     *
     * 此外, 这里也无法使用onReady进行操作, 具体请参考: http://taro-docs.jd.com/taro/docs/react-page#onready-
     * 此问题目前仅出现在飞书小程序, 字节小程序正常.
     */
    const MAX_TIMES = 100;
    for (let i = 0; i < MAX_TIMES; i++) {
      // 获取domRef
      const domref: IDomRef = await getDomRef();

      if (domref === null || domref === undefined) {
        // 如果不存在, 则重复循环, 最多尝试100次. 确保不会死循环.
        continue;
      }

      // 初始化图表
      Taro.getSystemInfo({
        success: res => {
          this.init({ domref, dpr: res.pixelRatio });
        },
        fail: res => {
          console.error(new Error('taro 暂不支持该环境'));
          console.log(res);
        }
      });
      break;
    }
  }

  componentDidUpdate(prevProps: GeneralChartProps) {
    if (
      this.ttCanvas &&
      this.ttCanvas.chartInstance &&
      JSON.stringify(prevProps.spec) !== JSON.stringify(this.props.spec)
    ) {
      this.ttCanvas.updateSpec(this.props);
    }
  }

  componentWillUnmount() {
    this.ttCanvas && this.ttCanvas.release();
  }

  async init({ domref, dpr = 2 }: { domref: IDomRef; dpr: number }) {
    if (!domref) {
      console.error(`未找到 #${this.props.canvasId} 组件`);
      return;
    }

    if (this.props.mode === 'wx' || this.props.mode === 'tt') {
      // 微信小程序和TT小程序环境特殊处理
      const canvasIdLists = [
        `${this.props.canvasId}_draw_canvas`,
        `${this.props.canvasId}_tooltip_canvas`,
        `${this.props.canvasId}_hidden_canvas`
      ];

      const { chartConstructor } = this.props;
      const { vglobal } = chartConstructor as any;
      if (vglobal) {
        await vglobal.setEnv(this.props.mode, {
          domref,
          force: true,
          canvasIdLists,
          freeCanvasIdx: 2,
          component: undefined,
          forceUpdate: true
        });
      }
    }

    domref.id = this.props.canvasId;
    this.ttCanvas = new TTCanvas({
      chartConstructor: this.props.chartConstructor,
      dpr: dpr,
      domref,
      spec: this.props.spec,
      events: this.props.events,
      options: this.props.options,
      mode: this.props.mode,
      onChartInit: (chart: IVChart) => {
        this.props?.onChartInit && this.props.onChartInit(chart);
      },
      onChartReady: (chart: IVChart) => {
        this.props?.onChartReady && this.props.onChartReady(chart);
      },
      onChartUpdate: (chart: IVChart) => {
        this.props?.onChartUpdate && this.props.onChartUpdate(chart);
      }
    });
  }

  render() {
    const handleEvent = (event: any) => {
      if (this.ttCanvas && this.ttCanvas.chartInstance) {
        const chartInstance = this.ttCanvas.chartInstance;

        Object.defineProperty(event, 'target', {
          writable: false,
          value: chartInstance.getCanvas() // Tip: 必须设置
        });
        chartInstance.getStage().window.dispatchEvent(event);
      }
    };
    const { canvasId, style = {} } = this.props;
    const type = this.props.mode === 'wx' || this.props.mode === 'tt' ? '2d' : undefined;
    return (
      <View key={canvasId} style={{ ...style_container, ...style, padding: 0 }}>
        <Canvas
          type={type}
          style={{
            ...style_cs_tooltip_canvas
          }}
          onTouchStart={handleEvent}
          onTouchMove={handleEvent}
          onTouchEnd={handleEvent}
          id={`${canvasId}_tooltip_canvas`}
          canvasId={`${canvasId}_tooltip_canvas`}
        ></Canvas>
        <Canvas
          type={type}
          style={style_cs_canvas}
          id={`${canvasId}_draw_canvas`}
          canvasId={`${canvasId}_draw_canvas`}
        ></Canvas>
        <Canvas
          type={type}
          style={{
            ...style_cs_canvas,
            ...style_cs_canvas_hidden
          }}
          id={`${canvasId}_hidden_canvas`}
          canvasId={`${canvasId}_hidden_canvas`}
        ></Canvas>
      </View>
    );
  }
}
