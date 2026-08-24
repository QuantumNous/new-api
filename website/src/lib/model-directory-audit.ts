import type { Modality } from "./model-directory-meta";

export type AuditIssueStatus = "missing" | "invalid" | "unknown-model" | "stale-metadata";

export type AuditIssueKind = "field" | "coverage" | "collision";

export type AffectedFilter =
  | "metadata"
  | "vendor"
  | "providers"
  | "modalities"
  | "context"
  | "inputPrice"
  | "outputPrice"
  | "series"
  | "categories"
  | "age"
  | "distillable"
  | "identity";

export type TrustedSuggestion = {
  suggestedValue: unknown;
  suggestedSource: string;
  confidence: "low" | "medium" | "high";
};

export type AuditModelDirectoryRow = {
  modelId?: string | number;
  name: string;
  vendor: string;
  billingUnit?: string;
  inputFilterUsd?: number | null;
  outputFilterUsd?: number | null;
  /** Input-only token models may legitimately have no output charge. */
  outputPriceZeroAllowed?: boolean;
};

export type AuditModelDirectoryMetadata = {
  series?: string;
  vendor?: string;
  providers?: string[];
  modalities?: Modality[];
  contextTokens?: number | null;
  categories?: string[];
  releasedAt?: string | null;
  distillable?: boolean;
  aliases?: string[];
};

export type AuditIssue = {
  modelId: string;
  modelName: string;
  field: string;
  status: AuditIssueStatus;
  kind: AuditIssueKind;
  currentValue: unknown;
  suggestedValue?: unknown;
  suggestedSource?: string;
  confidence?: "low" | "medium" | "high";
  affectedFilters: AffectedFilter[];
  backfillSqlEligible: boolean;
  reviewStatus: "pending";
};

export type ModelDirectoryAuditReport = {
  generatedAt: string;
  source: string;
  modelCount: number;
  metadataCount: number;
  issues: AuditIssue[];
  wroteProduction: false;
};

export type AuditModelDirectoryCatalogInput = {
  generatedAt?: string;
  source: string;
  rows: AuditModelDirectoryRow[];
  identityRows?: AuditModelDirectoryRow[];
  metadata: Record<string, AuditModelDirectoryMetadata>;
  suggestions?: Record<string, TrustedSuggestion>;
};

const VALID_BILLING_UNITS = new Set(["token", "request", "second"]);

const STATUS_ORDER: Record<AuditIssueStatus, number> = {
  invalid: 0,
  missing: 1,
  "unknown-model": 2,
  "stale-metadata": 3,
};

export function auditModelDirectoryCatalog(input: AuditModelDirectoryCatalogInput): ModelDirectoryAuditReport {
  const issues: AuditIssue[] = [];
  const rows = input.rows.filter((row) => row && typeof row.name === "string" && row.name.trim() !== "");
  const metadataEntries = Object.entries(input.metadata);
  const liveNames = new Set(rows.map((row) => row.name));

  for (const issue of collisionIssues(input.identityRows ?? rows, input.metadata, input.suggestions)) issues.push(issue);

  for (const row of rows) {
    const metadata = input.metadata[row.name];
    validateRowPricing(row, issues, input.suggestions);
    if (!metadata) {
      issues.push(
        makeIssue({
          row,
          field: "metadata",
          status: "unknown-model",
          kind: "coverage",
          currentValue: undefined,
          affectedFilters: allMetadataFilters(),
          suggestions: input.suggestions,
        })
      );
      continue;
    }
    validateMetadata(row, metadata, issues, input.suggestions);
  }

  for (const [modelName, metadata] of metadataEntries) {
    if (!liveNames.has(modelName)) {
      issues.push(
        makeIssue({
          row: { name: modelName },
          field: "metadata",
          status: "stale-metadata",
          kind: "coverage",
          currentValue: metadata,
          affectedFilters: allMetadataFilters(),
          suggestions: input.suggestions,
        })
      );
    }
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: input.source,
    modelCount: rows.length,
    metadataCount: metadataEntries.length,
    issues: sortIssues(issues),
    wroteProduction: false,
  };
}

export function renderModelDirectoryAuditMarkdown(report: ModelDirectoryAuditReport): string {
  const lines = [
    "# Model Directory Metadata Audit",
    "",
    `Generated at: ${report.generatedAt}`,
    `Source: ${report.source}`,
    `Live models audited: ${report.modelCount}`,
    `Metadata entries audited: ${report.metadataCount}`,
    `Issue count: ${report.issues.length}`,
    `Wrote production: ${report.wroteProduction}`,
    "",
    "**No production writes were performed.**",
    "",
    "Review these findings before any database update. This report is read-only audit evidence, not an automatic backfill plan.",
    "",
  ];

  if (report.issues.length === 0) {
    lines.push("No issues found.");
    return `${lines.join("\n")}\n`;
  }

  const statusCounts = countIssueStatuses(report.issues);
  const filterCounts = countAffectedFilters(report.issues);
  lines.push("## Issue totals by severity");
  lines.push("");
  lines.push("| Severity | Total |");
  lines.push("| --- | ---: |");
  for (const status of AUDIT_STATUS_ORDER) {
    const count = statusCounts.get(status) ?? 0;
    if (count > 0) lines.push(`| ${escapeMarkdown(status)} | ${count} |`);
  }
  lines.push("");
  lines.push("## Issue totals by affected filter");
  lines.push("");
  lines.push("| Filter | Total |");
  lines.push("| --- | ---: |");
  for (const [filter, count] of [...filterCounts.entries()].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    lines.push(`| ${escapeMarkdown(filter)} | ${count} |`);
  }
  lines.push("");
  lines.push("## Issue details");
  lines.push("");
  lines.push("| Status | Model | Field | Affected filters | Current value | Suggested value | Suggested source | Confidence | Review status |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const issue of report.issues) {
    lines.push(
      `| ${escapeMarkdown(issue.status)} | ${escapeMarkdown(issue.modelName)} | ${escapeMarkdown(issue.field)} | ${escapeMarkdown(issue.affectedFilters.join(", "))} | ${escapeMarkdown(formatValue(issue.currentValue))} | ${escapeMarkdown(formatOptionalValue(issue.suggestedValue))} | ${escapeMarkdown(issue.suggestedSource ?? "")} | ${escapeMarkdown(issue.confidence ?? "")} | ${escapeMarkdown(issue.reviewStatus)} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

const AUDIT_STATUS_ORDER: AuditIssue["status"][] = ["invalid", "missing", "unknown-model", "stale-metadata"];

function countIssueStatuses(issues: AuditIssue[]): Map<AuditIssue["status"], number> {
  const counts = new Map<AuditIssue["status"], number>();
  for (const issue of issues) counts.set(issue.status, (counts.get(issue.status) ?? 0) + 1);
  return counts;
}

function countAffectedFilters(issues: AuditIssue[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    for (const filter of issue.affectedFilters) counts.set(filter, (counts.get(filter) ?? 0) + 1);
  }
  return counts;
}

export function renderModelDirectoryAuditJson(report: ModelDirectoryAuditReport): string {
  return `${JSON.stringify(report, auditJsonValueReplacer, 2)}\n`;
}

function validateRowPricing(
  row: AuditModelDirectoryRow,
  issues: AuditIssue[],
  suggestions: Record<string, TrustedSuggestion> | undefined
) {
  if (!VALID_BILLING_UNITS.has(row.billingUnit ?? "")) {
    issues.push(
      makeIssue({
        row,
        field: "billingUnit",
        status: row.billingUnit == null ? "missing" : "invalid",
        kind: "field",
        currentValue: row.billingUnit,
        affectedFilters: ["inputPrice", "outputPrice"],
        suggestions,
      })
    );
  }
  validatePrice(row, "inputFilterUsd", row.inputFilterUsd, ["inputPrice"], issues, suggestions);
  validatePrice(row, "outputFilterUsd", row.outputFilterUsd, ["outputPrice"], issues, suggestions, row.outputPriceZeroAllowed === true);
}

function validatePrice(
  row: AuditModelDirectoryRow,
  field: "inputFilterUsd" | "outputFilterUsd",
  value: number | null | undefined,
  affectedFilters: AffectedFilter[],
  issues: AuditIssue[],
  suggestions: Record<string, TrustedSuggestion> | undefined,
  allowZero = false
) {
  if (value == null) {
    issues.push(makeIssue({ row, field, status: "missing", kind: "field", currentValue: value, affectedFilters, suggestions }));
    return;
  }
  if (!Number.isFinite(value) || value < 0 || (value === 0 && !allowZero)) {
    issues.push(makeIssue({ row, field, status: "invalid", kind: "field", currentValue: value, affectedFilters, suggestions }));
  }
}

function validateMetadata(
  row: AuditModelDirectoryRow,
  metadata: AuditModelDirectoryMetadata,
  issues: AuditIssue[],
  suggestions: Record<string, TrustedSuggestion> | undefined
) {
  validateNonEmptyString(row, "vendor", metadata.vendor, ["vendor"], issues, suggestions);
  validateNonEmptyString(row, "series", metadata.series, ["series"], issues, suggestions);
  validateNonEmptyArray(row, "providers", metadata.providers, ["providers"], issues, suggestions);
  validateNonEmptyArray(row, "modalities", metadata.modalities, ["modalities"], issues, suggestions);
  validateContext(row, metadata.contextTokens, issues, suggestions);
  validateNonEmptyArray(row, "categories", metadata.categories, ["categories"], issues, suggestions);
  validateReleasedAt(row, metadata.releasedAt, issues, suggestions);
  if (metadata.distillable == null) {
    issues.push(
      makeIssue({
        row,
        field: "distillable",
        status: "missing",
        kind: "field",
        currentValue: metadata.distillable,
        affectedFilters: ["distillable"],
        suggestions,
      })
    );
  } else if (typeof metadata.distillable !== "boolean") {
    issues.push(
      makeIssue({
        row,
        field: "distillable",
        status: "invalid",
        kind: "field",
        currentValue: metadata.distillable,
        affectedFilters: ["distillable"],
        suggestions,
      })
    );
  }
}

function validateNonEmptyString(
  row: AuditModelDirectoryRow,
  field: keyof AuditModelDirectoryMetadata & string,
  value: unknown,
  affectedFilters: AffectedFilter[],
  issues: AuditIssue[],
  suggestions: Record<string, TrustedSuggestion> | undefined
) {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    issues.push(makeIssue({ row, field, status: "missing", kind: "field", currentValue: value, affectedFilters, suggestions }));
  } else if (typeof value !== "string") {
    issues.push(makeIssue({ row, field, status: "invalid", kind: "field", currentValue: value, affectedFilters, suggestions }));
  }
}

function validateNonEmptyArray(
  row: AuditModelDirectoryRow,
  field: keyof AuditModelDirectoryMetadata & string,
  value: unknown,
  affectedFilters: AffectedFilter[],
  issues: AuditIssue[],
  suggestions: Record<string, TrustedSuggestion> | undefined
) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(
      makeIssue({
        row,
        field,
        status: value == null || (Array.isArray(value) && value.length === 0) ? "missing" : "invalid",
        kind: "field",
        currentValue: value,
        affectedFilters,
        suggestions,
      })
    );
  } else if (!value.every((item) => typeof item === "string" && item.trim() !== "")) {
    issues.push(makeIssue({ row, field, status: "invalid", kind: "field", currentValue: value, affectedFilters, suggestions }));
  }
}

function validateContext(
  row: AuditModelDirectoryRow,
  value: unknown,
  issues: AuditIssue[],
  suggestions: Record<string, TrustedSuggestion> | undefined
) {
  if (value === undefined) {
    issues.push(
      makeIssue({
        row,
        field: "contextTokens",
        status: "missing",
        kind: "field",
        currentValue: value,
        affectedFilters: ["context"],
        suggestions,
      })
    );
  } else if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
    issues.push(
      makeIssue({
        row,
        field: "contextTokens",
        status: "invalid",
        kind: "field",
        currentValue: value,
        affectedFilters: ["context"],
        suggestions,
      })
    );
  }
}

function validateReleasedAt(
  row: AuditModelDirectoryRow,
  value: unknown,
  issues: AuditIssue[],
  suggestions: Record<string, TrustedSuggestion> | undefined
) {
  if (value == null || value === "") {
    issues.push(makeIssue({ row, field: "releasedAt", status: "missing", kind: "field", currentValue: value, affectedFilters: ["age"], suggestions }));
    return;
  }
  if (typeof value !== "string" || !isStrictCalendarDate(value)) {
    issues.push(makeIssue({ row, field: "releasedAt", status: "invalid", kind: "field", currentValue: value, affectedFilters: ["age"], suggestions }));
  }
}

function isStrictCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function collisionIssues(
  rows: AuditModelDirectoryRow[],
  metadata: Record<string, AuditModelDirectoryMetadata>,
  suggestions: Record<string, TrustedSuggestion> | undefined
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const byName = new Map<string, AuditModelDirectoryRow[]>();
  for (const row of rows) byName.set(row.name, [...(byName.get(row.name) ?? []), row]);

  for (const [name, duplicates] of byName) {
    const providers = new Set(duplicates.map((row) => row.vendor).filter(Boolean));
    const modelIds = new Set(duplicates.map((row) => normalizeModelId(row.modelId)).filter((id): id is string => id != null));
    if (duplicates.length > 1 && (providers.size > 1 || modelIds.size > 1)) {
      issues.push(
        makeIssue({
          row: duplicates[0] ?? { name, vendor: "" },
          field: "identity",
          status: "invalid",
          kind: "collision",
          currentValue: duplicates.map((row) => ({ modelId: row.modelId, name: row.name, vendor: row.vendor })),
          affectedFilters: ["identity", "vendor"],
          suggestions,
        })
      );
    }
  }

  const identityOwners = new Map<string, string[]>();
  for (const [name, meta] of Object.entries(metadata)) {
    for (const identity of [name, ...(meta.aliases ?? [])]) {
      identityOwners.set(identity, [...(identityOwners.get(identity) ?? []), name]);
    }
  }
  for (const [identity, owners] of identityOwners) {
    const distinct = [...new Set(owners)];
    if (distinct.length > 1) {
      issues.push(
        makeIssue({
          row: { name: identity },
          field: "identity",
          status: "invalid",
          kind: "collision",
          currentValue: { identity, owners: distinct.sort() },
          affectedFilters: ["identity", "metadata"],
          suggestions,
        })
      );
    }
  }

  return dedupeIssues(issues);
}

function normalizeModelId(modelId: AuditModelDirectoryRow["modelId"]): string | undefined {
  if (modelId == null) return undefined;
  const value = String(modelId).trim();
  return value === "" ? undefined : value;
}

function makeIssue(input: {
  row: Pick<AuditModelDirectoryRow, "modelId" | "name">;
  field: string;
  status: AuditIssueStatus;
  kind: AuditIssueKind;
  currentValue: unknown;
  affectedFilters: AffectedFilter[];
  suggestions?: Record<string, TrustedSuggestion>;
}): AuditIssue {
  const suggestion = input.suggestions?.[suggestionKey(input.row.name, input.field)];
  const hasTrustedSuggestion = suggestion?.suggestedSource && suggestion.suggestedValue !== undefined;
  return {
    modelId: String(input.row.modelId ?? input.row.name),
    modelName: input.row.name,
    field: input.field,
    status: input.status,
    kind: input.kind,
    currentValue: input.currentValue,
    ...(hasTrustedSuggestion
        ? {
            suggestedValue: suggestion.suggestedValue,
            suggestedSource: suggestion.suggestedSource,
            confidence: suggestion.confidence,
          }
      : {}),
    affectedFilters: [...input.affectedFilters],
    backfillSqlEligible: Boolean(hasTrustedSuggestion),
    reviewStatus: "pending",
  };
}

function suggestionKey(modelName: string, field: string): string {
  return `${modelName}:${field}`;
}

function sortIssues(issues: AuditIssue[]): AuditIssue[] {
  return dedupeIssues(issues).sort((a, b) => {
    const status = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (status !== 0) return status;
    return (
      a.modelName.localeCompare(b.modelName, "en", { numeric: true }) ||
      a.field.localeCompare(b.field, "en", { numeric: true }) ||
      a.kind.localeCompare(b.kind, "en", { numeric: true })
    );
  });
}

function dedupeIssues(issues: AuditIssue[]): AuditIssue[] {
  const seen = new Set<string>();
  const deduped: AuditIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.status}:${issue.kind}:${issue.modelName}:${issue.field}:${formatValue(issue.currentValue)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }
  return deduped;
}

function allMetadataFilters(): AffectedFilter[] {
  return ["metadata", "vendor", "providers", "modalities", "context", "series", "categories", "age", "distillable"];
}

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatOptionalValue(value: unknown): string {
  return value === undefined ? "" : formatValue(value);
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function auditJsonValueReplacer(key: string, value: unknown): unknown {
  if (key === "currentValue" && value === undefined) return "undefined";
  if (typeof value !== "number" || Number.isFinite(value)) return value;
  if (Number.isNaN(value)) return "NaN";
  return value === Number.POSITIVE_INFINITY ? "Infinity" : "-Infinity";
}
