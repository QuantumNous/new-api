"use client";

import type { ReactNode } from "react";

type Props = {
  mode: "agent" | "sdk";
  className: string;
  children: ReactNode;
};

export function QuickStartJumpButton({ mode, className, children }: Props) {
  const targetHash = `#${mode}-quickstart`;

  const scrollToQuickstart = () => {
    window.history.pushState(null, "", targetHash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    document.getElementById("quickstart")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button type="button" data-quickstart-target={mode} onClick={scrollToQuickstart} className={className}>
      {children}
    </button>
  );
}
