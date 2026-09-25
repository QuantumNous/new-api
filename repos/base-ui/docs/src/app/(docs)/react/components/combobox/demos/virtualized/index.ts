import { createDemoWithVariants } from 'docs/src/utils/createDemo';
import CssModules from './css-modules';
import Tailwind from './tailwind';

export const DemoComboboxVirtualized = createDemoWithVariants(import.meta.url, {
  CssModules,
  Tailwind,
});
