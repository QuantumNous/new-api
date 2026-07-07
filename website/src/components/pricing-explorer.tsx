"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, Filter, RotateCcw, Search } from "lucide-react";
import { ModelsDirectoryTable } from "@/components/models-directory-table";
import { ModelLogo } from "@/components/pricing-model-browser";
import { getHomeCopy } from "@/lib/home-copy";
import { buildRowsForModels } from "@/lib/home-models";
import {
  filterPricingModels,
  getTopEndpoints,
  getTopVendors,
  sortPricingModelsBySeries,
  type PricingModel,
  type PricingSearch,
  type PricingVendor,
} from "@/lib/pricing";
import { localizePath, type Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type PricingExplorerProps = {
  locale: Locale;
  models: PricingModel[];
  vendors: PricingVendor[];
  groupRatio: Record<string, number>;
  usableGroup: Record<string, { desc: string; ratio: number }>;
  endpointMap: Record<string, unknown>;
  autoGroups: string[];
  initialSearch?: PricingSearch;
};

const ALL = "all";

export function PricingExplorer(props: PricingExplorerProps) {
  const [query, setQuery] = useState(props.initialSearch?.q ?? "");
  const [vendor, setVendor] = useState(props.initialSearch?.vendor ?? ALL);
  const [quota, setQuota] = useState(props.initialSearch?.quota ?? ALL);
  const [endpoint, setEndpoint] = useState(props.initialSearch?.endpoint ?? ALL);

  const filteredModels = useMemo(
    () =>
      sortPricingModelsBySeries(
        filterPricingModels(props.models, {
          q: query,
          vendor,
          quota,
          endpoint,
        })
      ),
    [endpoint, props.models, query, quota, vendor]
  );
  const visibleModels = filteredModels.slice(0, 120);
  const topVendors = useMemo(() => getTopVendors(props.models, 18), [props.models]);
  const topEndpoints = useMemo(() => getTopEndpoints(props.models, 10), [props.models]);
  const hasActiveFilters = vendor !== ALL || quota !== ALL || endpoint !== ALL;

  const resetFilters = () => {
    setVendor(ALL);
    setQuota(ALL);
    setEndpoint(ALL);
  };

  return (
    <>
      <section className="mb-4 rounded-3xl border border-violet-500/14 bg-white/72 p-5 shadow-[0_18px_64px_-56px_rgba(91,33,182,0.62)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_18px_64px_-56px_rgba(124,58,237,0.95)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-foreground inline-flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl">
              <span className="bg-muted/70 border-border text-foreground/80 inline-flex size-9 shrink-0 items-center justify-center rounded-full border">
                <Boxes className="size-5" aria-hidden="true" />
              </span>
              {copy(props.locale, "enabledModels", { count: props.models.length.toLocaleString() })}
            </h2>
          </div>

          <div className="relative w-full lg:max-w-xl">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy(props.locale, "searchPlaceholder")}
              className="border-input bg-background h-11 w-full rounded-full border px-4 pl-10 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/15"
              type="search"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] self-start overflow-y-auto rounded-3xl border border-violet-300/35 bg-white/60 p-4 shadow-[0_24px_80px_rgba(91,33,182,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_80px_-56px_rgba(124,58,237,0.95)] xl:block">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-950 dark:text-white">{copy(props.locale, "filter")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{copy(props.locale, "filterHint")}</p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-500/10 disabled:pointer-events-none disabled:opacity-40 dark:text-violet-200 dark:hover:bg-violet-300/10"
            >
              <RotateCcw className="size-3.5" />
              {copy(props.locale, "reset")}
            </button>
          </div>

          {hasActiveFilters ? <span className="mb-3 inline-flex rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{copy(props.locale, "filtersActive")}</span> : null}

          <div className="space-y-1">
            <FilterSection title={copy(props.locale, "allVendors")}>
              <FilterChip
                href={pricingHref(props.locale)}
                label={copy(props.locale, "allVendors")}
                count={props.models.length}
                active={vendor === ALL}
                onClick={() => setVendor(ALL)}
              />
              {topVendors.map((vendorName) => {
                const vendorInfo = props.vendors.find((item) => item.name === vendorName);
                const count = props.models.filter((model) => model.vendor_name === vendorName).length;
                return (
                  <FilterChip
                    key={vendorName}
                    href={pricingHref(props.locale, { vendor: vendorName })}
                    label={vendorName}
                    count={count}
                    active={vendor === vendorName}
                    icon={vendorInfo?.icon ? <ModelLogo iconKey={vendorInfo.icon} fallback={vendorName.charAt(0)} size={14} /> : undefined}
                    onClick={() => setVendor(vendorName)}
                  />
                );
              })}
            </FilterSection>

            <FilterSection title={copy(props.locale, "pricingType")}>
              <FilterChip label={copy(props.locale, "allModels")} count={props.models.length} active={quota === ALL} onClick={() => setQuota(ALL)} />
              <FilterChip label={copy(props.locale, "tokenBased")} count={props.models.filter((model) => model.quota_type === 0).length} active={quota === "token"} onClick={() => setQuota("token")} />
              <FilterChip label={copy(props.locale, "perRequest")} count={props.models.filter((model) => model.quota_type === 1).length} active={quota === "request"} onClick={() => setQuota("request")} />
            </FilterSection>

            <FilterSection title={copy(props.locale, "endpointType")}>
              <FilterChip label={copy(props.locale, "allTypes")} count={props.models.length} active={endpoint === ALL} onClick={() => setEndpoint(ALL)} />
              {topEndpoints.map((endpointName) => (
                <FilterChip
                  key={endpointName}
                  label={endpointName}
                  count={props.models.filter((model) => model.supported_endpoint_types?.includes(endpointName)).length}
                  active={endpoint === endpointName}
                  onClick={() => setEndpoint(endpointName)}
                />
              ))}
            </FilterSection>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-violet-300/35 bg-white/60 p-3 shadow-[0_20px_70px_rgba(91,33,182,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_20px_70px_-56px_rgba(124,58,237,0.95)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-baseline gap-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-black tabular-nums text-slate-950 dark:text-white">{filteredModels.length.toLocaleString()}</span>
                <span>{filteredModels.length === 1 ? copy(props.locale, "model") : copy(props.locale, "models")}</span>
                {filteredModels.length !== props.models.length ? <span className="text-xs text-slate-400 dark:text-slate-500">/ {props.models.length.toLocaleString()}</span> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  const sidebar = document.querySelector<HTMLElement>("[data-pricing-mobile-filters]");
                  sidebar?.classList.toggle("hidden");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-violet-300/30 bg-white/65 px-3 text-xs font-bold text-slate-700 dark:border-violet-300/20 dark:bg-white/[0.06] dark:text-slate-200 xl:hidden"
              >
                <Filter className="size-4" />
                {copy(props.locale, "filter")}
              </button>
            </div>
          </div>

          <div data-pricing-mobile-filters className="hidden rounded-3xl border border-violet-300/35 bg-white/60 p-4 shadow-[0_20px_70px_rgba(91,33,182,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.055] xl:hidden">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-black text-slate-950 dark:text-white">{copy(props.locale, "filter")}</span>
              <button type="button" onClick={resetFilters} className="text-xs font-medium text-violet-700 dark:text-violet-200">{copy(props.locale, "reset")}</button>
            </div>
            <div className="space-y-3">
              <MobileFilterRow title={copy(props.locale, "pricingType")}>
                <FilterChip label={copy(props.locale, "allModels")} active={quota === ALL} onClick={() => setQuota(ALL)} />
                <FilterChip label={copy(props.locale, "tokenBased")} active={quota === "token"} onClick={() => setQuota("token")} />
                <FilterChip label={copy(props.locale, "perRequest")} active={quota === "request"} onClick={() => setQuota("request")} />
              </MobileFilterRow>
              <MobileFilterRow title={copy(props.locale, "allVendors")}>
                <FilterChip label={copy(props.locale, "allVendors")} active={vendor === ALL} onClick={() => setVendor(ALL)} />
                {topVendors.slice(0, 8).map((vendorName) => (
                  <FilterChip key={vendorName} label={vendorName} active={vendor === vendorName} onClick={() => setVendor(vendorName)} />
                ))}
              </MobileFilterRow>
            </div>
          </div>

          {visibleModels.length > 0 ? (
            <ModelsDirectoryTable
              copy={getHomeCopy(props.locale).table}
              rows={buildRowsForModels(visibleModels, props.vendors, props.groupRatio)}
              locale={props.locale}
            />
          ) : (
            <div className="border-border bg-card flex min-h-64 flex-col items-center justify-center rounded-3xl border px-6 py-14 text-center">
              <Boxes className="text-muted-foreground size-10" />
              <h2 className="mt-4 text-lg font-semibold">{copy(props.locale, "noModels")}</h2>
              <p className="text-muted-foreground mt-2 max-w-md text-sm">{copy(props.locale, "noModelsHint")}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function FilterSection(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-violet-300/25 border-b pb-3 last:border-b-0 dark:border-white/10">
      <h3 className="py-2.5 text-sm font-bold text-slate-950 dark:text-white">{props.title}</h3>
      <div className="flex flex-wrap gap-1.5">{props.children}</div>
    </section>
  );
}

function MobileFilterRow(props: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">{props.title}</h3>
      <div className="flex flex-wrap gap-1.5">{props.children}</div>
    </section>
  );
}

function FilterChip(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  href?: string;
  icon?: React.ReactNode;
}) {
  const className = cn(
    "group inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all",
    props.active
      ? "border-violet-400/50 bg-violet-500/15 text-violet-900 shadow-[0_0_24px_rgba(168,85,247,0.14)] dark:border-violet-300/40 dark:bg-violet-300/15 dark:text-violet-100"
      : "border-violet-300/25 bg-white/55 text-slate-600 hover:border-violet-400/45 hover:bg-violet-500/10 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-violet-300/30 dark:hover:bg-violet-300/10 dark:hover:text-white"
  );
  const content = (
    <>
      {props.icon ? <span className="shrink-0">{props.icon}</span> : null}
      <span className="truncate">{props.label}</span>
      {props.count != null ? <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", props.active ? "bg-white/80 text-violet-900 dark:bg-white/15 dark:text-violet-100" : "bg-violet-500/10 text-violet-700 dark:bg-violet-300/10 dark:text-violet-200")}>{props.count}</span> : null}
    </>
  );

  if (props.href) {
    return (
      <Link
        href={props.href}
        onClick={(event) => {
          event.preventDefault();
          props.onClick();
          window.history.replaceState(null, "", props.href);
        }}
        className={className}
        title={props.label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={className} title={props.label}>
      {content}
    </button>
  );
}

function pricingHref(locale: Locale, params?: { vendor?: string }) {
  const search = new URLSearchParams();
  if (params?.vendor) search.set("vendor", params.vendor);
  const query = search.toString();
  return `${localizePath("/pricing", locale)}${query ? `?${query}` : ""}`;
}

const COPY: Record<string, Record<string, string>> = {
  en: {
    enabledModels: "This site currently has {{count}} models enabled",
    searchPlaceholder: "Search model name, provider, endpoint, or tag...",
    filter: "Filter",
    filterHint: "Refine models by provider, type, and endpoint.",
    reset: "Reset",
    filtersActive: "Filters active",
    allVendors: "All Vendors",
    pricingType: "Pricing Type",
    endpointType: "Endpoint Type",
    allModels: "All Models",
    tokenBased: "Token-based",
    perRequest: "Per Request",
    allTypes: "All Types",
    model: "model",
    models: "models",
    noModels: "No Models Found",
    noModelsHint: "No models match your current filters.",
  },
  zh: {
    enabledModels: "本站当前已启用 {{count}} 个模型",
    searchPlaceholder: "搜索模型名称、供应商、端点或标签...",
    filter: "筛选",
    filterHint: "按供应商、计费类型和端点筛选模型。",
    reset: "重置",
    filtersActive: "筛选已启用",
    allVendors: "全部供应商",
    pricingType: "计费类型",
    endpointType: "端点类型",
    allModels: "全部模型",
    tokenBased: "按 Token 计费",
    perRequest: "按请求计费",
    allTypes: "全部类型",
    model: "个模型",
    models: "个模型",
    noModels: "未找到模型",
    noModelsHint: "没有模型匹配当前筛选条件。",
  },
  es: {
    enabledModels: "Este sitio tiene {{count}} modelos habilitados",
    searchPlaceholder: "Buscar nombre de modelo, proveedor, endpoint o etiqueta...",
    filter: "Filtrar",
    filterHint: "Refina modelos por proveedor, tipo y endpoint.",
    reset: "Restablecer",
    filtersActive: "Filtros activos",
    allVendors: "Todos los proveedores",
    pricingType: "Tipo de precio",
    endpointType: "Tipo de endpoint",
    allModels: "Todos los modelos",
    tokenBased: "Por token",
    perRequest: "Por solicitud",
    allTypes: "Todos los tipos",
    model: "modelo",
    models: "modelos",
    noModels: "No se encontraron modelos",
    noModelsHint: "Ningún modelo coincide con los filtros actuales.",
  },
  fr: {
    enabledModels: "Ce site a actuellement {{count}} modèles activés",
    searchPlaceholder: "Rechercher un modèle, fournisseur, endpoint ou tag...",
    filter: "Filtrer",
    filterHint: "Affinez les modèles par fournisseur, type et endpoint.",
    reset: "Réinitialiser",
    filtersActive: "Filtres actifs",
    allVendors: "Tous les fournisseurs",
    pricingType: "Type de tarif",
    endpointType: "Type d'endpoint",
    allModels: "Tous les modèles",
    tokenBased: "Au token",
    perRequest: "Par requête",
    allTypes: "Tous les types",
    model: "modèle",
    models: "modèles",
    noModels: "Aucun modèle trouvé",
    noModelsHint: "Aucun modèle ne correspond aux filtres actuels.",
  },
  pt: {
    enabledModels: "Este site tem {{count}} modelos habilitados",
    searchPlaceholder: "Pesquisar nome do modelo, provedor, endpoint ou tag...",
    filter: "Filtrar",
    filterHint: "Refine modelos por provedor, tipo e endpoint.",
    reset: "Redefinir",
    filtersActive: "Filtros ativos",
    allVendors: "Todos os provedores",
    pricingType: "Tipo de preço",
    endpointType: "Tipo de endpoint",
    allModels: "Todos os modelos",
    tokenBased: "Por token",
    perRequest: "Por requisição",
    allTypes: "Todos os tipos",
    model: "modelo",
    models: "modelos",
    noModels: "Nenhum modelo encontrado",
    noModelsHint: "Nenhum modelo corresponde aos filtros atuais.",
  },
  ru: {
    enabledModels: "На сайте сейчас включено {{count}} моделей",
    searchPlaceholder: "Поиск по модели, провайдеру, endpoint или тегу...",
    filter: "Фильтр",
    filterHint: "Уточните модели по провайдеру, типу и endpoint.",
    reset: "Сбросить",
    filtersActive: "Фильтры активны",
    allVendors: "Все провайдеры",
    pricingType: "Тип цены",
    endpointType: "Тип endpoint",
    allModels: "Все модели",
    tokenBased: "По токенам",
    perRequest: "За запрос",
    allTypes: "Все типы",
    model: "модель",
    models: "моделей",
    noModels: "Модели не найдены",
    noModelsHint: "Ни одна модель не соответствует текущим фильтрам.",
  },
  ja: {
    enabledModels: "このサイトでは現在 {{count}} 個のモデルが有効です",
    searchPlaceholder: "モデル名、プロバイダー、endpoint、タグを検索...",
    filter: "フィルター",
    filterHint: "プロバイダー、種類、endpoint でモデルを絞り込みます。",
    reset: "リセット",
    filtersActive: "フィルター適用中",
    allVendors: "すべてのプロバイダー",
    pricingType: "料金タイプ",
    endpointType: "Endpoint タイプ",
    allModels: "すべてのモデル",
    tokenBased: "Token ベース",
    perRequest: "リクエスト単位",
    allTypes: "すべてのタイプ",
    model: "モデル",
    models: "モデル",
    noModels: "モデルが見つかりません",
    noModelsHint: "現在のフィルターに一致するモデルはありません。",
  },
  vi: {
    enabledModels: "Site này hiện có {{count}} mô hình được bật",
    searchPlaceholder: "Tìm tên mô hình, nhà cung cấp, endpoint hoặc tag...",
    filter: "Lọc",
    filterHint: "Lọc mô hình theo nhà cung cấp, loại và endpoint.",
    reset: "Đặt lại",
    filtersActive: "Bộ lọc đang bật",
    allVendors: "Tất cả nhà cung cấp",
    pricingType: "Loại giá",
    endpointType: "Loại endpoint",
    allModels: "Tất cả mô hình",
    tokenBased: "Theo token",
    perRequest: "Theo request",
    allTypes: "Tất cả loại",
    model: "mô hình",
    models: "mô hình",
    noModels: "Không tìm thấy mô hình",
    noModelsHint: "Không có mô hình nào khớp với bộ lọc hiện tại.",
  },
};

function copy(locale: Locale, key: string, values?: Record<string, string>) {
  let text = COPY[locale]?.[key] ?? COPY.en[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) text = text.replace(`{{${name}}}`, value);
  return text;
}
