"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, Filter, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelsDirectoryTable } from "@/components/models-directory-table";
import { ModelsFeaturedCarousel } from "@/components/models-featured-carousel";
import { ModelsFilterSidebar, type FilterGroup } from "@/components/models-filter-sidebar";
import { buildRowsForModels, finalHomePricedRowsByName, type HomePricedModel } from "@/lib/home-models";
import { localizePath, type Locale } from "@/lib/locales";
import {
  AGE_BAND_LABELS,
  MODALITY_LABELS,
  SORT_LABELS,
  categoryLabel,
  formatCount,
  getDirectoryCopy,
} from "@/lib/model-directory-copy";
import { buildFeaturedSlides } from "@/lib/model-directory-featured";
import {
  buildDirectoryRow,
  DIRECTORY_SORTS,
  EMPTY_DIRECTORY_FILTERS,
  filterDirectoryRows,
  hasActiveFilters,
  sortDirectoryRows,
  type DirectoryFilterKey,
  type DirectoryFilters,
  type DirectorySort,
} from "@/lib/model-directory-filters";
import {
  AGE_BANDS,
  CONTEXT_BUCKETS,
  MODALITIES,
  PRICE_BANDS,
  categoriesForModels,
  formatContextTokens,
  providersForModels,
  seriesForModels,
  vendorsForModels,
} from "@/lib/model-directory-meta";
import { directoryHref, parseDirectorySearch, toggleDirectoryFilter } from "@/lib/model-directory-url";
import type { GroupModelRatio, PricingModel, PricingVendor } from "@/lib/pricing";

// The /models directory: a featured carousel, a faceted filter sidebar, and the
// pricing table. All pricing, latency and health figures come from the live API
// via buildRowsForModels; only the filter dimensions the API cannot supply come
// from the static metadata table.

type Props = {
  locale: Locale;
  models: PricingModel[];
  vendors: PricingVendor[];
  groupRatio: Record<string, number>;
  groupModelRatio?: GroupModelRatio;
  initialSearch?: Record<string, string | string[] | undefined>;
};

const SEARCH_DEBOUNCE_MS = 160;
const MAX_VISIBLE_ROWS = 200;

export function ModelsDirectory(props: Props) {
  const copy = getDirectoryCopy(props.locale);
  const initial = useMemo(() => parseDirectorySearch(props.initialSearch), [props.initialSearch]);

  const [filters, setFilters] = useState<DirectoryFilters>(() => stripSort(initial));
  const [sort, setSort] = useState<DirectorySort>(initial.sort);
  const [searchInput, setSearchInput] = useState(initial.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Debounced so typing does not re-run the facet sweep on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.q === searchInput ? current : { ...current, q: searchInput }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Back/forward should restore the view the URL describes.
  useEffect(() => {
    const onPopState = () => {
      const restored = parseDirectorySearch(Object.fromEntries(new URLSearchParams(window.location.search)));
      setFilters(stripSort(restored));
      setSort(restored.sort);
      setSearchInput(restored.q ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const priced = useMemo(
    () => buildRowsForModels(props.models, props.vendors, props.groupRatio, props.groupModelRatio),
    [props.models, props.vendors, props.groupRatio, props.groupModelRatio]
  );
  const finalPriced = useMemo(() => finalHomePricedRowsByName(priced), [priced]);
  const pricedByName = useMemo(() => new Map(finalPriced.map((row) => [row.name, row])), [finalPriced]);

  // Rows carry everything filtering and sorting need, resolved once per model.
  const rows = useMemo(
    () =>
      finalPriced.map((row) =>
        buildDirectoryRow({
          name: row.name,
          vendor: row.vendor,
          inputUsd: row.inputFilterUsd,
          outputUsd: row.outputFilterUsd,
          // Official rate drives the discount sort; both sides come from the
          // live payload so a reprice re-sorts on the next render.
          officialUsd: row.officialUsd,
          endpointTypes: row.endpointTypes,
        })
      ),
    [finalPriced]
  );

  const matched = useMemo(() => sortDirectoryRows(filterDirectoryRows(rows, filters), sort), [rows, filters, sort]);
  const visible = useMemo(
    () =>
      matched
        .slice(0, MAX_VISIBLE_ROWS)
        .map((row) => toTableRow(row.name, pricedByName))
        .filter((row): row is NonNullable<typeof row> => row != null),
    [matched, pricedByName]
  );

  const groups = useMemo(
    () => buildFilterGroups(props.locale, rows.map((row) => row.name)),
    [props.locale, rows]
  );
  const featured = useMemo(() => buildFeaturedSlides(props.models.map((model) => model.model_name)), [props.models]);
  const canReset = hasActiveFilters(filters) || sort !== "rank";

  // Filter state is mirrored into the URL so reloads and shared links restore
  // the view, and search engines get crawlable entry points per slice.
  const syncUrl = useCallback(
    (nextFilters: DirectoryFilters, nextSort: DirectorySort) => {
      window.history.replaceState(null, "", directoryHref(props.locale, nextFilters, nextSort));
    },
    [props.locale]
  );

  useEffect(() => {
    syncUrl(filters, sort);
  }, [filters, sort, syncUrl]);

  const onToggle = (key: DirectoryFilterKey, value: string | number | boolean) => {
    setFilters((current) => toggleDirectoryFilter(current, key, value as never));
  };

  const onReset = () => {
    setFilters(EMPTY_DIRECTORY_FILTERS);
    setSort("rank");
    setSearchInput("");
  };

  const sidebar = (
    <ModelsFilterSidebar
      groups={groups}
      filters={filters}
      rows={rows}
      title={copy.filter}
      resetLabel={copy.reset}
      canReset={canReset}
      onToggle={onToggle}
      onReset={onReset}
    />
  );

  return (
    <>
      <ModelsFeaturedCarousel slides={featured} copy={copy} locale={props.locale} />

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* No max-height or internal scroll: the sidebar grows to whatever the
            expanded groups need. `sticky top-4` still parks it while the much
            taller results column scrolls past. */}
        <aside className="sticky top-4 hidden self-start rounded-2xl border border-[#E7E4EC] bg-white p-4 shadow-[0_1px_2px_rgba(24,14,38,0.04),0_12px_32px_-26px_rgba(24,14,38,0.2)] dark:border-white/10 dark:bg-white/[0.03] xl:block">
          {sidebar}
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[#E7E4EC] bg-white p-4 shadow-[0_1px_2px_rgba(24,14,38,0.04),0_12px_32px_-26px_rgba(24,14,38,0.2)] dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  aria-label={copy.searchPlaceholder}
                  className="h-10 w-full rounded-xl border border-[#E7E4EC] bg-[#FBFAFC] px-4 pl-10 text-sm text-[#0B0B0F] outline-none transition-all duration-200 placeholder:text-[#9CA3AF] focus:border-[#C9B8FF] focus:bg-white focus:ring-4 focus:ring-[#C9B8FF]/25 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((open) => !open)}
                  aria-expanded={mobileFiltersOpen}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E7E4EC] bg-white px-4 text-xs font-bold text-[#45414C] transition-all duration-200 hover:border-[#C9B8FF] hover:bg-[#F8F4FF] hover:text-[#0B0B0F] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 xl:hidden"
                >
                  <Filter className="size-4" aria-hidden="true" />
                  {copy.filter}
                </button>

                {/* Base UI Select rather than a native <select>: the native
                    popup renders as an OS menu that covers the toolbar and
                    cannot be styled. This one portals above the page and keeps
                    the site's chip styling. */}
                <Select.Root
                  modal={false}
                  value={sort}
                  onValueChange={(value) => {
                    if (typeof value === "string") setSort(value as DirectorySort);
                  }}
                >
                  <Select.Trigger
                    aria-label={copy.sortLabel}
                    className="group flex h-10 min-w-[168px] cursor-pointer items-center gap-2 rounded-xl border border-[#E7E4EC] bg-white px-3 text-left text-sm font-semibold text-[#45414C] outline-none transition-all duration-200 hover:border-[#C9B8FF] hover:bg-[#F8F4FF] hover:text-[#0B0B0F] focus-visible:border-[#C9B8FF] focus-visible:ring-4 focus-visible:ring-[#C9B8FF]/25 data-popup-open:border-[#C9B8FF] data-popup-open:bg-[#F8F4FF] data-popup-open:ring-4 data-popup-open:ring-[#C9B8FF]/25 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200"
                  >
                    <SlidersHorizontal className="size-4 shrink-0 text-[#9CA3AF]" aria-hidden="true" />
                    <Select.Value className="min-w-0 flex-1 truncate">{SORT_LABELS[props.locale][sort]}</Select.Value>
                    <Select.Icon className="shrink-0 text-[#9CA3AF] transition-transform duration-200 group-data-popup-open:rotate-180">
                      <ChevronDown className="size-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner
                      align="end"
                      alignItemWithTrigger={false}
                      className="z-[1100] outline-none"
                      collisionPadding={16}
                      side="bottom"
                      sideOffset={6}
                    >
                      <Select.Popup className="min-w-[var(--anchor-width)] max-w-[var(--available-width)] origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-[#E7E4EC] bg-white p-1.5 shadow-[0_24px_60px_-30px_rgba(24,14,38,0.4)] outline-none transition-[transform,opacity] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 dark:border-white/10 dark:bg-[#14121B]">
                        <Select.List className="max-h-[min(var(--available-height),15rem)] overflow-y-auto outline-none">
                          {DIRECTORY_SORTS.map((option) => (
                            <Select.Item
                              key={option}
                              value={option}
                              label={SORT_LABELS[props.locale][option]}
                              className="grid min-h-9 cursor-pointer grid-cols-[1fr_auto] items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-[#45414C] outline-none transition-colors data-[highlighted]:bg-[#F3EDFF] data-[highlighted]:text-[#5B21B6] data-[selected]:bg-[#F3EDFF] data-[selected]:text-[#5B21B6] dark:text-slate-300 dark:data-[highlighted]:bg-violet-300/10 dark:data-[highlighted]:text-violet-100 dark:data-[selected]:bg-violet-300/10 dark:data-[selected]:text-violet-100"
                            >
                              <Select.ItemText className="min-w-0 truncate">{SORT_LABELS[props.locale][option]}</Select.ItemText>
                              <Select.ItemIndicator className="text-[#6D28D9] dark:text-violet-300">
                                <Check className="size-3.5" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.List>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-[#EFECF3] pt-3 dark:border-white/10">
              <h2 className="text-[17px] font-black tracking-tight text-[#0B0B0F] dark:text-white">{copy.allModels}</h2>
              <span className="text-[13px] text-[#6B7280] tabular-nums dark:text-slate-400">
                {formatCount(copy.modelsFound, matched.length)}
              </span>
            </div>
          </div>

          {mobileFiltersOpen ? (
            <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-[#E7E4EC] bg-white p-4 shadow-[0_1px_2px_rgba(24,14,38,0.04),0_12px_32px_-26px_rgba(24,14,38,0.2)] duration-300 dark:border-white/10 dark:bg-white/[0.03] xl:hidden">
              {sidebar}
            </div>
          ) : null}

          {visible.length > 0 ? (
            <ModelsDirectoryTable copy={copy} rows={visible} locale={props.locale} />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#E7E4EC] bg-white px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold text-[#0B0B0F] dark:text-white">{copy.noResults}</h3>
              <p className="mt-2 max-w-md text-sm text-[#6B7280] dark:text-slate-400">{copy.noResultsHint}</p>
              <button
                type="button"
                onClick={onReset}
                className="mt-4 inline-flex h-9 items-center rounded-xl bg-[#6D28D9] px-4 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#5B21B6] hover:shadow-[0_8px_20px_-10px_rgba(91,33,182,0.7)]"
              >
                {copy.clearFilters}
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function stripSort(parsed: DirectoryFilters & { sort: DirectorySort }): DirectoryFilters {
  const { sort: _sort, ...filters } = parsed;
  return filters;
}

function toTableRow(name: string, priced: Map<string, HomePricedModel>) {
  const row = priced.get(name);
  if (!row) return null;
  return {
    name: row.name,
    vendor: row.vendor,
    series: row.series,
    official: row.official,
    discounted: row.discounted,
    officialUsd: row.officialUsd,
    discountedUsd: row.discountedUsd,
    priceUnit: row.priceUnit,
    pricePrefix: row.pricePrefix,
    contextTokens: row.contextTokens ?? null,
    top10: row.top10,
    iconKey: row.iconKey,
  };
}

function buildFilterGroups(locale: Locale, modelNames: string[]): FilterGroup[] {
  const copy = getDirectoryCopy(locale);
  return [
    {
      key: "modalities",
      label: copy.groupModalities,
      defaultOpen: true,
      options: MODALITIES.map((value) => ({ value, label: MODALITY_LABELS[locale][value] })),
    },
    {
      key: "context",
      label: copy.groupContext,
      defaultOpen: true,
      options: CONTEXT_BUCKETS.map((value) => ({
        value,
        // The largest bucket is the ceiling, so "1M+" would overstate it.
        label: value === CONTEXT_BUCKETS[CONTEXT_BUCKETS.length - 1] ? "1M" : `${formatContextTokens(value)}+`,
      })),
    },
    {
      key: "inputPrice",
      label: copy.groupInputPrice,
      defaultOpen: true,
      options: PRICE_BANDS.map((band) => ({ value: band.id, label: priceBandLabel(band) })),
    },
    {
      key: "outputPrice",
      label: copy.groupOutputPrice,
      options: PRICE_BANDS.map((band) => ({ value: band.id, label: priceBandLabel(band) })),
    },
    {
      key: "vendors",
      label: copy.groupVendors,
      defaultOpen: true,
      options: vendorsForModels(modelNames).map((value) => ({ value, label: value })),
    },
    {
      key: "providers",
      label: copy.groupProviders,
      // Where each model is officially served. Sourced from the metadata table
      // because the pricing payload does not expose a routing map yet.
      options: providersForModels(modelNames).map((value) => ({ value, label: value })),
    },
    {
      key: "series",
      label: copy.groupSeries,
      options: seriesForModels(modelNames).map((value) => ({ value, label: value })),
    },
    {
      key: "categories",
      label: copy.groupCategories,
      options: categoriesForModels(modelNames).map((value) => ({ value, label: categoryLabel(locale, value) })),
    },
    {
      key: "age",
      label: copy.groupAge,
      options: AGE_BANDS.map((value) => ({ value, label: AGE_BAND_LABELS[locale][value] })),
    },
    {
      key: "distillable",
      label: copy.groupDistillable,
      options: [
        { value: true, label: copy.yes },
        { value: false, label: copy.no },
      ],
    },
  ];
}

/** Price bands read as currency ranges: "< $0.5", "$0.5–$1", "$10+". */
function priceBandLabel(band: (typeof PRICE_BANDS)[number]): string {
  const min = "min" in band ? band.min : undefined;
  const max = "max" in band ? band.max : undefined;
  if (min == null && max != null) return `< $${max}`;
  if (min != null && max == null) return `$${min}+`;
  return `$${min}–$${max}`;
}
