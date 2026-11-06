import React from 'react';
import { IChartProps, IVChart, RenderMode } from '../../typings';

export interface WebChartProps extends IChartProps {
  /**
   * vchart 的环境参数
   */
  mode?: RenderMode;
}

export class WebChart extends React.Component<WebChartProps> {
  private vchart: IVChart;

  constructor(props: IChartProps) {
    super(props);
  }

  componentDidMount() {
    const { onChartInit, onChartReady, mode, chartConstructor }: any = this.props;
    if (!chartConstructor) {
      console.error('chartConstructor not found');
    }
    this.vchart = new chartConstructor(this.props.spec, {
      dom: `${this.props.canvasId}`,
      mode,
      ...this.props.options
    }) as IVChart;

    onChartInit && onChartInit(this.vchart);

    this.vchart
      .renderAsync()
      .then(() => {
        onChartReady && onChartReady(this.vchart);
      })
      .catch((e: any) => {
        console.error(e);
      });
  }

  componentWillUnmount() {
    if (!this.vchart) return;
    this.vchart && this.vchart.release();
  }

  componentDidUpdate(prevProps: IChartProps) {
    if (!this.vchart) return;

    const { spec, onChartReady } = this.props;

    if (JSON.stringify(prevProps.spec) !== JSON.stringify(spec)) {
      this.vchart.updateSpec(spec, true);
      onChartReady && onChartReady(this.vchart);
    }
  }

  render() {
    const { canvasId, style } = this.props;
    return (
      <div
        style={{
          position: 'relative',
          ...style,
          padding: 0
        }}
        id={`${canvasId}`}
      ></div>
    );
  }
}

export default WebChart;
