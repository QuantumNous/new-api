import { createTooltip } from './BaseTooltip';
import type { TooltipProps } from './interface';
import { registerTooltip, registerCanvasTooltipHandler } from '@visactor/vchart';

export const CanvasTooltip = createTooltip<TooltipProps>('CanvasTooltip', 'tooltip', [
  registerTooltip,
  registerCanvasTooltipHandler
]);
