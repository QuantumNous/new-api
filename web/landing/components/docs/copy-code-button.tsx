"use client";

import { useEffect, useState } from "react";
import { IconAlertCircle, IconCheck, IconCopy } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

export function CopyCodeButton({ value }: { value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const label =
    status === "copied" ? "已复制代码" : status === "error" ? "复制失败，请重试" : "复制代码";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className="pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 absolute top-3 right-3 z-10 text-neutral-300 opacity-100 transition-opacity duration-150 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:ring-white/40"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setStatus("copied");
          } catch {
            setStatus("error");
          }
        }}
      >
        {status === "copied" ? (
          <IconCheck aria-hidden="true" />
        ) : status === "error" ? (
          <IconAlertCircle aria-hidden="true" className="text-red-600" />
        ) : (
          <IconCopy aria-hidden="true" />
        )}
      </Button>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "idle" ? "" : label}
      </span>
    </>
  );
}
