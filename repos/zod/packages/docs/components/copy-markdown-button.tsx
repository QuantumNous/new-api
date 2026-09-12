"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CopyMarkdownButtonProps {
  content: string;
  className?: string;
}

export function CopyMarkdownButton({ content, className = "" }: CopyMarkdownButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy markdown:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs text-fd-muted-foreground hover:text-fd-foreground border border-[var(--color-fd-border)] rounded hover:bg-fd-muted/50 transition-colors ${className}`}
      title="Copy markdown content"
    >
      <div className="flex items-center gap-1.5">
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        <span>Copy markdown</span>
      </div>
    </button>
  );
}
