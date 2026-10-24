import { createSitemap } from '@mui/internal-docs-infra/createSitemap';
import Overview from '../(docs)/react/overview/page.mdx';
import Handbook from '../(docs)/react/handbook/page.mdx';
import Components from '../(docs)/react/components/page.mdx';
import Utils from '../(docs)/react/utils/page.mdx';

export const sitemap = createSitemap(import.meta.url, {
  Overview,
  Handbook,
  Components,
  Utils,
});
