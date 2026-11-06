'use client';
import * as React from 'react';
import { useMediaQuery } from '@base-ui/react/unstable-use-media-query';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

export interface GoogleAnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  params?: Record<string, string | number | boolean>;
}

export interface GoogleAnalyticsContextValue {
  trackEvent: (event: GoogleAnalyticsEvent) => void;
}

export const GoogleAnalyticsContext = React.createContext<GoogleAnalyticsContextValue | null>(null);

export function useGoogleAnalytics() {
  return React.useContext(GoogleAnalyticsContext);
}

export interface GoogleAnalyticsProviderProps {
  id: string;
  productId: string;
  productCategoryId: string;
  codeStylingVariant: string | null;
  codeLanguage: string;
  currentRoute: string;
  userLanguage: string;
  children?: React.ReactNode;
}

export function GoogleAnalyticsProvider({
  id,
  productId,
  productCategoryId,
  codeLanguage,
  codeStylingVariant,
  currentRoute,
  userLanguage,
  children,
}: GoogleAnalyticsProviderProps) {
  useIsoLayoutEffect(() => {
    window.dataLayer = window.dataLayer || [];

    const gtag: Gtag.Gtag = function gtag() {
      // gtag expects the Arguments object
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };

    window.gtag = gtag;

    gtag('js', new Date());

    gtag('config', id, {
      send_page_view: false,
    });
  }, [id]);

  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    // Wait for the title to be updated.
    // React fires useEffect twice in dev mode
    clearTimeout(timeout.current ?? undefined);
    timeout.current = setTimeout(() => {
      // Remove hash as it's never sent to the server
      // https://github.com/vercel/next.js/issues/25202
      const canonicalAsServer = window.location.pathname.replace(/#(.*)$/, '');

      // https://developers.google.com/analytics/devguides/collection/ga4/views?client_type=gtag
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: canonicalAsServer,
        productId,
        productCategoryId,
      });
    });
  }, [currentRoute, productCategoryId, productId]);

  React.useEffect(() => {
    window.gtag('set', 'user_properties', {
      codeVariant: codeLanguage,
    });
  }, [codeLanguage]);

  React.useEffect(() => {
    window.gtag('set', 'user_properties', {
      codeStylingVariant,
    });
  }, [codeStylingVariant]);

  React.useEffect(() => {
    window.gtag('set', 'user_properties', {
      userLanguage,
    });
  }, [userLanguage]);

  React.useEffect(() => {
    /**
     * Based on https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#Monitoring_screen_resolution_or_zoom_level_changes
     * Adjusted to track 3 or more different ratios
     */
    function trackDevicePixelRatio() {
      const devicePixelRatio = Math.round(window.devicePixelRatio * 10) / 10;
      window.gtag('set', 'user_properties', {
        devicePixelRatio,
      });
    }

    trackDevicePixelRatio();

    const matchMedia: MediaQueryList = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );

    matchMedia.addEventListener('change', trackDevicePixelRatio);
    return () => {
      matchMedia.removeEventListener('change', trackDevicePixelRatio);
    };
  }, []);

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const preferredColorScheme = prefersDarkMode ? 'dark' : 'light';

  React.useEffect(() => {
    window.gtag('set', 'user_properties', {
      colorSchemeOS: preferredColorScheme,
    });
  }, [preferredColorScheme]);

  const contextValue = React.useMemo<GoogleAnalyticsContextValue>(
    () => ({
      trackEvent({ category, action, label, params }) {
        window.gtag('event', category, {
          action,
          label,
          ...params,
        });
      },
    }),
    [],
  );

  return (
    <GoogleAnalyticsContext.Provider value={contextValue}>
      {children}
    </GoogleAnalyticsContext.Provider>
  );
}
