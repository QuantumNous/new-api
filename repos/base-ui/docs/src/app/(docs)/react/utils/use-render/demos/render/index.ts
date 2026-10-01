import { createDemoWithVariants } from 'docs/src/utils/createDemo';
import CssModules from './css-modules';

export const DemoUseRenderRender = createDemoWithVariants(
  import.meta.url,
  { CssModules },
  { highlightAfter: 'init', enhanceAfter: 'init' },
);
