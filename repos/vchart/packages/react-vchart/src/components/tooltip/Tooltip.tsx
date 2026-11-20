import { createTooltip } from './BaseTooltip';
import type { TooltipProps } from './interface';
import { registerTooltip, registerDomTooltipHandler } from '@visactor/vchart';

export const Tooltip = createTooltip<TooltipProps>('Tooltip', 'tooltip', [registerTooltip, registerDomTooltipHandler]);
