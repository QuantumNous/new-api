import { Factory } from '../../core/factory';
import { DimensionHoverEvent, DimensionEventEnum, DimensionClickEvent } from './dimension';

export * from './dimension';

export const registerDimensionEvents = () => {
  Factory.registerComposedEvent(DimensionEventEnum.dimensionHover, DimensionHoverEvent);
  Factory.registerComposedEvent(DimensionEventEnum.dimensionClick, DimensionClickEvent);
};
