"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronRight } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

export const Accordion = forwardRef<
  HTMLDivElement,
  Omit<ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>, "value"> & {
    title: string;
  }
>(({ title, className, children, ...props }, ref) => {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      value={title}
      className={`group/accordion relative scroll-m-20 ${className ?? ""}`}
      {...props}
    >
      <AccordionPrimitive.Header className="not-prose flex flex-row items-center font-medium text-fd-foreground">
        <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-2 p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring">
          <ChevronRight className="-ms-1 size-4 shrink-0 text-fd-muted-foreground transition-transform duration-200 group-data-[state=open]/accordion:rotate-90" />
          {title}
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content
        forceMount
        className="overflow-hidden [--height:auto] max-h-[--height] data-[state=closed]:hidden data-[state=closed]:animate-[collapse-out_200ms_cubic-bezier(0.3,0.0,0.8,0.15)] data-[state=open]:animate-[collapse-in_250ms_cubic-bezier(0.05,0.7,0.1,1.0)]"
      >
        <div className="p-4 pt-0 prose-no-margin">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
});

Accordion.displayName = "Accordion";
