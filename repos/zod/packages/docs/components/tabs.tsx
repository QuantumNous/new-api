"use client";

import { Primitive, Tab, type TabsProps } from "fumadocs-ui/components/tabs";
import React from "react";

interface ChildProps {
  title: string;
  children: React.ReactNode;
}

const Tabs = ({ children, ...rest }: TabsProps) => {
  const validChildren = React.Children.toArray(children)
    .filter(React.isValidElement)
    .filter((child: any) => child.props.title);

  if (validChildren.length === 0) {
    console.warn("Tabs expects at least one valid Tab child, but none were found.");
    return null;
  }

  const tabs = validChildren.map((child) => {
    const { title } = child.props as ChildProps;
    return title;
  });

  return (
    <Primitive.Tabs items={tabs} className="border-none rounded-none px-0" defaultValue={tabs[0]} {...rest}>
      <Primitive.TabsList className="px-0 bg-transparent border-b gap-6">
        {validChildren.map((child) => {
          const { title } = child.props as ChildProps;
          return (
            <Primitive.TabsTrigger
              key={title}
              value={title}
              className="font-medium data-[state=active]:shadow-[inset_0_-1px_0_0_currentColor,_0_1px_0_0_currentColor]"
            >
              {title}
            </Primitive.TabsTrigger>
          );
        })}
      </Primitive.TabsList>
      {validChildren.map((child) => {
        const { title, children: childContent, ...props } = child.props as ChildProps;

        return (
          <Primitive.TabsContent
            forceMount
            key={title}
            value={title}
            className="px-0 data-[state=inactive]:hidden"
            {...props}
          >
            {childContent}
          </Primitive.TabsContent>
        );
      })}
    </Primitive.Tabs>
  );
};

export { Tabs, Tab };
