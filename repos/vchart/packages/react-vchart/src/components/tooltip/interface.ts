import { PropsWithChildren, ReactNode } from 'react';
import { BaseComponentProps } from '../BaseComponent';
import type { ITooltipSpec, ITooltipActual, TooltipHandlerParams } from '@visactor/vchart';

export type TooltipProps = PropsWithChildren<ITooltipSpec & IReactTooltipProps & BaseComponentProps>;

export interface ITooltipRenderProps {
  tooltipElement: HTMLElement;
  actualTooltip: ITooltipActual;
  params: TooltipHandlerParams;
}

export type TooltipRender = (
  tooltipElement: HTMLElement,
  actualTooltip: ITooltipActual,
  params: TooltipHandlerParams
) => ReactNode;

export interface IReactTooltipProps {
  /**
   * tooltip 自定义渲染器
   * @since 1.10.0
   */
  tooltipRender?: TooltipRender;
  /**
   * 在应用 `tooltipRender` 配置时，是否保留默认 tooltip dom 元素的显示
   * @since 1.10.0
   */
  reserveDefaultTooltip?: boolean;
}
