"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  command: string;
  copyLabel: string;
  copiedLabel: string;
};

export function ToolsCommandBox(props: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    try {
      await navigator.clipboard.writeText(props.command);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = props.command;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  return (
    <button
      type="button"
      onClick={copyCommand}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#101014] px-4 py-4 text-left text-white shadow-[0_22px_60px_-32px_rgba(30,20,50,0.85)] transition-transform hover:-translate-y-0.5 sm:px-5"
      aria-label={copied ? props.copiedLabel : props.copyLabel}
    >
      <span className="font-mono text-violet-300" aria-hidden="true">$</span>
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[11px] whitespace-nowrap text-white/88 sm:text-sm">
        {props.command}
      </code>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/8 px-2.5 py-1.5 text-[11px] font-medium text-white/65 transition-colors group-hover:bg-white/12 group-hover:text-white">
        {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
        <span className="hidden sm:inline">{copied ? props.copiedLabel : props.copyLabel}</span>
      </span>
      <span className="sr-only" aria-live="polite">{copied ? props.copiedLabel : ""}</span>
    </button>
  );
}
