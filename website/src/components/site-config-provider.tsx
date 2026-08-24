"use client";

import { createContext, useContext, type ReactNode } from "react";

type SiteConfig = {
  docsUrl: string | null;
};

const SiteConfigContext = createContext<SiteConfig>({ docsUrl: null });

export function SiteConfigProvider(props: SiteConfig & { children: ReactNode }) {
  return <SiteConfigContext.Provider value={{ docsUrl: props.docsUrl }}>{props.children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(SiteConfigContext);
}
