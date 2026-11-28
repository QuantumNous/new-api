import { createDemoWithVariants } from 'docs/src/utils/createDemo';
import CssModules from './css-modules';
import Tailwind from './tailwind';

export const DemoCollapsibleHero = createDemoWithVariants(
  import.meta.url,
  { CssModules, Tailwind },
  { highlightAfter: 'init', enhanceAfter: 'init' },
);
