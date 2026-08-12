"use client";

import { Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Types = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingProps<T extends Types> = Omit<ComponentPropsWithoutRef<T>, "as"> & {
  as?: T;
};

export function Heading<T extends Types = "h1">({ as, className, ...props }: HeadingProps<T>): React.ReactElement {
  const As = as ?? "h1";

  if (!props.id) return <As className={className} {...props} />;

  return (
    <As className={`flex scroll-m-28 flex-row items-center gap-2 ${className}`} {...props}>
      <Link
        data-card=""
        // href={`#${props.id}`}
        href={`?id=${props.id}#${props.id}`}
        // onclick="event.preventDefault(); history.pushState(null, '', '?asdf=qwer');"
        className="peer"
      // shallow={true}
      // onClick={(e) => {
      //   // function __handleScroll(){
      //   // if id query parameter is present, scroll to the element with that id
      //   const params = new URLSearchParams(window.location.search);
      //   console.dir(params, { depth: null });
      //   const id = params.get("id");
      //   console.dir(params, { depth: null });
      //   if (id) {
      //     console.dir(document.getElementById(id), { depth: null });
      //     document.getElementById(id)?.scrollIntoView();
      //   }
      //   // }
      // }}
      >
        {props.children}
      </Link>
      <LinkIcon
        aria-label="Link to section"
        className="size-3.5 shrink-0 text-fd-muted-foreground opacity-0 transition-opacity peer-hover:opacity-100"
      />
    </As>
  );
}
