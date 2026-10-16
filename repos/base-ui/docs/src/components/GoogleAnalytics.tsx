'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { usePreference } from '@mui/internal-docs-infra/usePreference';
import { GoogleAnalyticsProvider } from 'docs/src/blocks/GoogleAnalyticsProvider';
import { GoogleTagManager } from '../blocks/GoogleTagManager';

const PRODUCTION_GA =
  process.env.DEPLOY_ENV === 'production' || process.env.DEPLOY_ENV === 'staging';
const GOOGLE_ANALYTICS_ID_V4 = PRODUCTION_GA ? 'G-FE5XQBD0BH' : 'G-LSE9X5R2CN';

export function GoogleAnalytics({ children }: { children?: React.ReactNode }) {
  const currentRoute = usePathname();
  const [stylingVariant] = usePreference('variant', 'CssModules:Tailwind', 'CssModules');

  return (
    <React.Fragment>
      <GoogleTagManager id={GOOGLE_ANALYTICS_ID_V4} />
      <GoogleAnalyticsProvider
        id={GOOGLE_ANALYTICS_ID_V4}
        productId="base-ui"
        productCategoryId="core"
        currentRoute={currentRoute}
        codeLanguage="ts"
        codeStylingVariant={stylingVariant}
        userLanguage="en"
      >
        {children}
      </GoogleAnalyticsProvider>
    </React.Fragment>
  );
}
