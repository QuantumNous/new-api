"use client";

import { useState } from "react";
import { IconMenu2, IconX } from "@tabler/icons-react";

import { DocsNavigation } from "@/components/docs/docs-navigation";
import { DocsSearch } from "@/components/docs/docs-search";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { DocsNavigationSection } from "@/lib/docs/types";

export function MobileDocsNavigation({ navigation }: { navigation: DocsNavigationSection[] }) {
  const [open, setOpen] = useState(false);
  const documents = navigation.flatMap((section) => section.documents);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" />}>
        <IconMenu2 aria-hidden="true" />
        <span className="sr-only">打开文档目录</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="docs-root w-[min(20rem,88vw)] shadow-none"
      >
        <SheetClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4 bg-neutral-100"
            />
          }
        >
          <IconX aria-hidden="true" />
          <span className="sr-only">关闭文档目录</span>
        </SheetClose>
        <SheetHeader className="border-b border-black/[0.06] px-5 py-5">
          <SheetTitle className="font-bold tracking-[-0.02em] [font-size:var(--docs-text-h6)]">
            文档目录
          </SheetTitle>
          <SheetDescription className="[font-size:var(--docs-text-sm)]">
            浏览 HelloCoder 使用文档
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pt-4">
          <DocsSearch documents={documents} onNavigate={() => setOpen(false)} />
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 py-7">
            <DocsNavigation navigation={navigation} onNavigate={() => setOpen(false)} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
