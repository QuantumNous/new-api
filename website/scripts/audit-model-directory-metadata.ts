import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  auditModelDirectoryCatalog,
  renderModelDirectoryAuditJson,
  renderModelDirectoryAuditMarkdown,
  type AuditModelDirectoryRow,
} from "../src/lib/model-directory-audit";
import { MODEL_DIRECTORY_META } from "../src/lib/model-directory-meta-data";
import { buildRowsForModels } from "../src/lib/home-models";
import { getVendorName } from "../src/lib/pricing";
import type {
  DisplayPricingDimension,
  DisplayPricingUnit,
  GroupModelRatio,
  ModelDisplayPricing,
  PricingModel,
  PricingVendor,
} from "../src/lib/pricing";

type PricingApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  vendors?: unknown;
  group_ratio?: unknown;
  group_model_ratio?: unknown;
  display_pricing?: unknown;
};

const JSON_REPORT_NAME = "production-model-directory-audit.json";
const MARKDOWN_REPORT_NAME = "production-model-directory-audit.md";

export type ModelDirectoryAuditCliDeps = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  mkdirImpl?: typeof mkdir;
  writeFileImpl?: typeof writeFile;
  logImpl?: (message: string) => void;
  now?: () => Date;
};

export async function runModelDirectoryAuditCli(deps: ModelDirectoryAuditCliDeps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const mkdirImpl = deps.mkdirImpl ?? mkdir;
  const writeFileImpl = deps.writeFileImpl ?? writeFile;
  const logImpl = deps.logImpl ?? console.log;
  const now = deps.now ?? (() => new Date());
  const origin = env.APP_CONSOLE_ORIGIN;
  if (!origin) throw new Error("APP_CONSOLE_ORIGIN is required");

  const pricingUrl = new URL("/api/website/pricing", origin);
  const response = await fetchImpl(pricingUrl, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`pricing fetch failed: ${response.status}`);

  const payload = (await response.json()) as PricingApiResponse;
  const auditCatalog = assembleAuditCatalogFromPricingPayload(payload);

  const report = auditModelDirectoryCatalog({
    generatedAt: now().toISOString(),
    source: pricingUrl.toString(),
    rows: auditCatalog.rows,
    identityRows: auditCatalog.identityRows,
    metadata: MODEL_DIRECTORY_META,
  });

  const outputDir = env.MODEL_DIRECTORY_AUDIT_OUT_DIR || "reports/model-directory";
  await mkdirImpl(outputDir, { recursive: true });
  const jsonPath = join(outputDir, JSON_REPORT_NAME);
  const markdownPath = join(outputDir, MARKDOWN_REPORT_NAME);
  await writeFileImpl(jsonPath, renderModelDirectoryAuditJson(report), "utf8");
  await writeFileImpl(markdownPath, renderModelDirectoryAuditMarkdown(report), "utf8");

  logImpl(`JSON report: ${jsonPath}`);
  logImpl(`Markdown report: ${markdownPath}`);
  logImpl(`Issue count: ${report.issues.length}`);
  logImpl("No production write occurred.");
}

export function assembleAuditRowsFromPricingPayload(payload: PricingApiResponse): AuditModelDirectoryRow[] {
  return assembleAuditCatalogFromPricingPayload(payload).rows;
}

export function assembleAuditCatalogFromPricingPayload(payload: PricingApiResponse): {
  rows: AuditModelDirectoryRow[];
  identityRows: AuditModelDirectoryRow[];
} {
  const { models, malformedRows, vendors, groupRatio, groupModelRatio } = parsePricingPayload(payload);
  const displayPricing = parseDisplayPricingMap(payload.display_pricing);
  const modelsWithDisplayPricing = models.map((model) => {
    const display = displayPricing[model.model_name];
    return display ? { ...model, display_pricing: display } : model;
  });
  const finalByName = new Map<string, { model: PricingModel; row: ReturnType<typeof buildRowsForModels>[number] | undefined }>();
  for (const model of modelsWithDisplayPricing) {
    const [row] = buildRowsForModels([model], vendors, groupRatio, groupModelRatio);
    const existing = finalByName.get(model.model_name);
    if (row || !existing || !existing.row) finalByName.set(model.model_name, { model, row });
  }
  const rows = [
    ...[...finalByName.values()].map(({ model, row }) => ({
      modelId: model.id,
      name: model.model_name,
      vendor: getVendorName(model, vendors),
      billingUnit: row?.billingUnit,
      inputFilterUsd: row?.inputFilterUsd,
      outputFilterUsd: row?.outputFilterUsd,
    })),
    ...malformedRows,
  ];
  const identityRows = [
    ...models.map((model) => ({
      modelId: model.id,
      name: model.model_name,
      vendor: getVendorName(model, vendors),
    })),
    ...malformedRows,
  ];
  return { rows, identityRows };
}

function parsePricingPayload(payload: PricingApiResponse) {
  if (!payload || payload.success !== true) throw new Error("pricing envelope invalid");
  if (!Array.isArray(payload.data)) throw new Error("pricing envelope invalid");

  const vendors = parseVendors(payload.vendors);
  const groupRatio = parseNumberRecord(payload.group_ratio);
  const groupModelRatio = parseGroupModelRatio(payload.group_model_ratio);
  const models: PricingModel[] = [];
  const malformedRows: AuditModelDirectoryRow[] = [];

  payload.data.forEach((entry, index) => {
    const model = parsePricingModel(entry);
    if (model) {
      models.push(model);
    } else {
      malformedRows.push({
        modelId: malformedModelId(entry),
        name: malformedModelName(entry, index),
        vendor: malformedVendor(entry, vendors),
        billingUnit: "malformed",
        inputFilterUsd: undefined,
        outputFilterUsd: undefined,
      });
    }
  });

  return { models, malformedRows, vendors, groupRatio, groupModelRatio };
}

function parsePricingModel(value: unknown): PricingModel | null {
  if (!isRecord(value)) return null;
  const modelName = value.model_name;
  if (typeof modelName !== "string" || modelName.trim() === "") return null;
  if (!isFiniteNumber(value.quota_type) || !isFiniteNumber(value.model_ratio) || !isFiniteNumber(value.completion_ratio)) {
    return null;
  }

  return {
    id: isFiniteNumber(value.id) ? value.id : undefined,
    model_name: modelName,
    description: stringOrUndefined(value.description),
    icon: stringOrUndefined(value.icon),
    vendor_id: isFiniteNumber(value.vendor_id) ? value.vendor_id : undefined,
    vendor_name: stringOrUndefined(value.vendor_name),
    vendor_icon: stringOrUndefined(value.vendor_icon),
    vendor_description: stringOrUndefined(value.vendor_description),
    quota_type: value.quota_type,
    model_ratio: value.model_ratio,
    completion_ratio: value.completion_ratio,
    model_price: isFiniteNumber(value.model_price) ? value.model_price : undefined,
    cache_ratio: nullableNumber(value.cache_ratio),
    create_cache_ratio: nullableNumber(value.create_cache_ratio),
    image_ratio: nullableNumber(value.image_ratio),
    audio_ratio: nullableNumber(value.audio_ratio),
    audio_completion_ratio: nullableNumber(value.audio_completion_ratio),
    enable_groups: stringArray(value.enable_groups),
    tags: stringOrUndefined(value.tags),
    supported_endpoint_types: stringArray(value.supported_endpoint_types),
    group_ratio: parseNumberRecord(value.group_ratio),
    group_model_ratio: parseNumberRecord(value.group_model_ratio),
    billing_mode: stringOrUndefined(value.billing_mode),
    billing_expr: stringOrUndefined(value.billing_expr),
    pricing_version: stringOrUndefined(value.pricing_version),
    featured_order: isFiniteNumber(value.featured_order) ? value.featured_order : undefined,
    availability_status: stringOrUndefined(value.availability_status),
    availability_reason: stringOrUndefined(value.availability_reason),
    availability_detected_at: isFiniteNumber(value.availability_detected_at) ? value.availability_detected_at : undefined,
    availability_checked_at: isFiniteNumber(value.availability_checked_at) ? value.availability_checked_at : undefined,
  };
}

function parseVendors(value: unknown): PricingVendor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || !isFiniteNumber(entry.id) || typeof entry.name !== "string") return [];
    return [
      {
        id: entry.id,
        name: entry.name,
        icon: stringOrUndefined(entry.icon),
        description: stringOrUndefined(entry.description),
      },
    ];
  });
}

function parseNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const parsed: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isFiniteNumber(entry)) parsed[key] = entry;
  }
  return parsed;
}

function parseGroupModelRatio(value: unknown): GroupModelRatio {
  if (!isRecord(value)) return {};
  const parsed: GroupModelRatio = {};
  for (const [group, ratios] of Object.entries(value)) {
    const modelRatios = parseNumberRecord(ratios);
    if (Object.keys(modelRatios).length > 0) parsed[group] = modelRatios;
  }
  return parsed;
}

function parseDisplayPricingMap(value: unknown): Record<string, ModelDisplayPricing> {
  if (!isRecord(value)) return {};
  const parsed: Record<string, ModelDisplayPricing> = {};
  for (const [modelName, entry] of Object.entries(value)) {
    const pricing = parseModelDisplayPricing(entry);
    if (pricing) parsed[modelName] = pricing;
  }
  return parsed;
}

function parseModelDisplayPricing(value: unknown): ModelDisplayPricing | null {
  if (!isRecord(value)) return null;
  const billingKind = value.billing_kind;
  if (!isDisplayPricingUnit(billingKind)) return null;
  if (!isRecord(value.prices)) return { billing_kind: billingKind, prices: {} };

  const prices: ModelDisplayPricing["prices"] = {};
  for (const [dimension, pair] of Object.entries(value.prices)) {
    if (!isDisplayPricingDimension(dimension) || !isRecord(pair)) continue;
    const configured = parseDisplayPriceValue(pair.configured);
    const plg = parseDisplayPriceValue(pair.plg);
    if (configured == null && plg == null) continue;
    prices[dimension] = {
      ...(configured == null ? {} : { configured }),
      ...(plg == null ? {} : { plg }),
      from: pair.from === true,
    };
  }

  return { billing_kind: billingKind, prices };
}

function parseDisplayPriceValue(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isDisplayPricingUnit(value: unknown): value is DisplayPricingUnit {
  return value === "per_second" || value === "request" || value === "token" || value === "tiered_expr";
}

function isDisplayPricingDimension(value: string): value is DisplayPricingDimension {
  return (
    value === "second" ||
    value === "request" ||
    value === "input" ||
    value === "output" ||
    value === "cache" ||
    value === "create_cache" ||
    value === "image" ||
    value === "audio_input" ||
    value === "audio_output"
  );
}

function malformedModelName(entry: unknown, index: number): string {
  if (isRecord(entry) && typeof entry.model_name === "string" && entry.model_name.trim() !== "") {
    return entry.model_name;
  }
  return `malformed-pricing-record-${index}`;
}

function malformedModelId(entry: unknown): string | number | undefined {
  if (!isRecord(entry)) return undefined;
  const id = entry.id;
  return typeof id === "string" || isFiniteNumber(id) ? id : undefined;
}

function malformedVendor(entry: unknown, vendors: PricingVendor[]): string {
  if (!isRecord(entry)) return "";
  if (typeof entry.vendor_name === "string") return entry.vendor_name;
  if (isFiniteNumber(entry.vendor_id)) return vendors.find((vendor) => vendor.id === entry.vendor_id)?.name ?? "";
  return "";
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return isFiniteNumber(value) ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  return parsed.length > 0 ? parsed : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.main) {
  runModelDirectoryAuditCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
