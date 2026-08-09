import type { Metadata } from "next";

import { docsConfig } from "@/app/docs/docs.config";
import { DocsHeader } from "@/components/docs/docs-header";
import { DocsNavigation } from "@/components/docs/docs-navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDocsNavigation } from "@/lib/docs/content";

export const metadata: Metadata = {
  title: {
    default: docsConfig.title,
    template: "%s | HC文档",
  },
  description: docsConfig.description,
};

export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const navigation = getDocsNavigation();

  return (
    <div className="docs-root min-h-svh bg-white text-neutral-950 lg:flex lg:h-svh lg:flex-col lg:overflow-hidden">
      <DocsHeader navigation={navigation} />
      <div className="grid w-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1344px)_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-hidden border-r border-black/[0.06] lg:col-start-2 lg:block">
          <ScrollArea className="h-full [&_[data-slot=scroll-area-scrollbar]]:hidden">
            <div className="px-4 py-10">
              <DocsNavigation navigation={navigation} />
            </div>
          </ScrollArea>
        </aside>
        <ScrollArea
          data-docs-content-scroll
          className="min-w-0 [&_[data-slot=scroll-area-viewport]]:overscroll-contain lg:col-span-2 lg:col-start-3 lg:min-h-0 lg:h-full"
        >
          <div className="min-w-0 lg:max-w-[1344px]">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
