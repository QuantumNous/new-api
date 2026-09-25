"use client";

import type { PageTree } from "fumadocs-core/server";
import {
  SidebarItem as InternalSidebarItem,
  SidebarSeparator as InternalSidebarSeparator,
} from "fumadocs-ui/layouts/docs/sidebar";

const Tags: Record<string, string> = {
  "/packages/v3": "Legacy",
};
export const SidebarItem = ({
  item,
}: {
  item: PageTree.Item;
}) => {
  const name = `${item.name}`;

  const tag = Tags[item.url]; //?.toUpperCase();
  return (
    <InternalSidebarItem key={item.url} href={item.url} external={item.external} icon={item.icon}>
      <div className="w-full flex flex-row justify-between">
        <p className="flex-grow">{name}</p>
        <p>
          {tag && (
            <span className="ml-0 mb-[-1px] text-xs px-1.5 py-0.5 bg-[#00000010] dark:bg-[#ffffff10] rounded-md">
              {tag}
            </span>
          )}
        </p>
      </div>
    </InternalSidebarItem>
  );
};

export const SidebarSeparator = ({
  item,
}: {
  item: PageTree.Separator;
}) => {
  return (
    <InternalSidebarSeparator
      className={"mt-8 text-lg tracking-wide dark:text-white"}
      style={{ fontVariant: "all-petite-caps" }}
    >
      {item.icon}
      {item.name}
    </InternalSidebarSeparator>
  );
};
