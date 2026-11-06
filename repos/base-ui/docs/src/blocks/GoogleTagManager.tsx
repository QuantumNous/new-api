import * as React from 'react';
import Script from 'next/script';

interface GoogleTagManagerProps {
  id: string;
}

export function GoogleTagManager(props: React.PropsWithChildren<GoogleTagManagerProps>) {
  const { id } = props;
  return (
    /**
     * A better alternative to <script async>, to delay its execution
     * https://developer.chrome.com/blog/script-component/
     */
    <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
  );
}
