"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { facetCount, type DirectoryFilterKey, type DirectoryFilters, type DirectoryRow } from "@/lib/model-directory-filters";
import { cn } from "@/lib/utils";

// Filter sidebar for the /models directory. Each group renders its options as
// chips whose facet count decides selectability: an option that would return
// nothing is disabled rather than hidden, so the shape of the catalogue stays
// visible even while a filter narrows it.

export type FilterOption = {
  value: string | number | boolean;
  label: string;
};

export type FilterGroup = {
  key: DirectoryFilterKey;
  label: string;
  options: FilterOption[];
  defaultOpen?: boolean;
};

type Props = {
  groups: FilterGroup[];
  filters: DirectoryFilters;
  rows: DirectoryRow[];
  title: string;
  resetLabel: string;
  canReset: boolean;
  onToggle: (key: DirectoryFilterKey, value: string | number | boolean) => void;
  onReset: () => void;
};

export function ModelsFilterSidebar(props: Props) {
  const [collapsed, setCollapsed] = useState<Set<DirectoryFilterKey>>(
    () => new Set(props.groups.filter((group) => !group.defaultOpen).map((group) => group.key))
  );

  const toggleGroup = (key: DirectoryFilterKey) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-black tracking-[0.02em] text-[#0B0B0F] dark:text-white">{props.title}</h2>
        <button
          type="button"
          onClick={props.onReset}
          disabled={!props.canReset}
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[11px] font-bold text-[#6B7280] transition-all duration-200 hover:bg-[#F3EDFF] hover:text-[#6B46C1] disabled:pointer-events-none disabled:opacity-35 dark:text-slate-400 dark:hover:bg-violet-300/10 dark:hover:text-violet-200"
        >
          <RotateCcw className="size-3 transition-transform duration-300 group-hover:-rotate-90" aria-hidden="true" />
          {props.resetLabel}
        </button>
      </div>

      {props.groups.map((group) => {
        const isOpen = !collapsed.has(group.key);
        const selected = props.filters[group.key] as Array<string | number | boolean>;

        return (
          <section key={group.key} className="border-b border-[#EFECF3] last:border-b-0 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={isOpen}
              className="group flex w-full items-center gap-2 py-3 text-left text-[13px] font-bold text-[#0B0B0F] transition-colors hover:text-[#6B46C1] dark:text-white dark:hover:text-violet-200"
            >
              <span className="flex-1">{group.label}</span>
              {selected.length > 0 ? (
                <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-[#6D28D9] px-1.5 text-[10px] font-bold text-white tabular-nums">
                  {selected.length}
                </span>
              ) : null}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0 text-[#9CA3AF] transition-transform duration-300 ease-out",
                  isOpen ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>

            {/* Grid-rows trick: animates height from 0 to content without
                measuring, and keeps the panel out of the tab order when shut. */}
            <div
              aria-hidden={isOpen ? undefined : true}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="flex flex-wrap gap-1.5 pb-3">
                  {group.options.map((option) => {
                    const active = selected.includes(option.value);
                    // The count is not displayed, but it still decides whether an
                    // option is selectable: a zero-result option stays disabled.
                    const disabled = !active && facetCount(props.rows, props.filters, group.key, option.value) === 0;

                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        tabIndex={isOpen ? undefined : -1}
                        onClick={() => props.onToggle(group.key, option.value)}
                        title={option.label}
                        className={cn(
                          "inline-flex max-w-full items-center rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ease-out active:scale-[0.97]",
                          active
                            ? "border-[#C9B8FF] bg-[#F3EDFF] text-[#5B21B6] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.14)] dark:border-violet-300/40 dark:bg-violet-300/15 dark:text-violet-100"
                            : "border-[#E7E4EC] bg-white text-[#45414C] hover:-translate-y-px hover:border-[#C9B8FF] hover:bg-[#F8F4FF] hover:text-[#0B0B0F] hover:shadow-[0_4px_10px_-6px_rgba(24,14,38,0.35)] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-violet-300/30 dark:hover:bg-violet-300/10 dark:hover:text-white",
                          disabled &&
                            "cursor-not-allowed border-[#F1EFF5] bg-[#FAFAFC] text-[#C4C2CC] hover:translate-y-0 hover:border-[#F1EFF5] hover:bg-[#FAFAFC] hover:text-[#C4C2CC] hover:shadow-none dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-600"
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
