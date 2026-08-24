import { describe, expect, test } from "bun:test";
import {
  auditModelDirectoryCatalog,
  renderModelDirectoryAuditJson,
  renderModelDirectoryAuditMarkdown,
  type AuditIssue,
  type AuditIssueStatus,
  type AuditModelDirectoryMetadata,
  type AuditModelDirectoryRow,
} from "./model-directory-audit";
import {
  assembleAuditCatalogFromPricingPayload,
  assembleAuditRowsFromPricingPayload,
  runModelDirectoryAuditCli,
} from "../../scripts/audit-model-directory-metadata";

const COMPLETE_META: AuditModelDirectoryMetadata = {
  series: "GPT",
  vendor: "OpenAI",
  providers: ["OpenAI"],
  modalities: ["text", "image"],
  contextTokens: 128000,
  categories: ["Programming"],
  releasedAt: "2026-01-15",
  distillable: false,
};

const COMPLETE_ROW: AuditModelDirectoryRow = {
  name: "gpt-test",
  vendor: "OpenAI",
  billingUnit: "token",
  inputFilterUsd: 0.75,
  outputFilterUsd: 2.25,
};

function audit(overrides?: {
  rows?: AuditModelDirectoryRow[];
  metadata?: Record<string, AuditModelDirectoryMetadata>;
  generatedAt?: string;
}) {
  return auditModelDirectoryCatalog({
    generatedAt: overrides?.generatedAt ?? "2026-08-21T00:00:00.000Z",
    source: "fixture",
    rows: overrides?.rows ?? [COMPLETE_ROW],
    metadata: overrides?.metadata ?? { [COMPLETE_ROW.name]: COMPLETE_META },
  });
}

function issueKeys(issues: AuditIssue[]) {
  return issues.map((issue) => `${issue.status}:${issue.modelName}:${issue.field}`);
}

describe("model directory metadata audit", () => {
  test("complete catalogue reports no issues and records no production writes", () => {
    const report = audit();

    expect(report).toEqual({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      modelCount: 1,
      metadataCount: 1,
      issues: [],
      wroteProduction: false,
    });
    expect(JSON.stringify(report, null, 2)).toContain('"wroteProduction": false');
  });

  test("missing required metadata fields are pending missing issues with affected filters", () => {
    const report = audit({
      metadata: {
        "gpt-test": {
          ...COMPLETE_META,
          vendor: "",
          providers: [],
          modalities: [],
          contextTokens: undefined,
          categories: [],
          releasedAt: undefined,
          distillable: undefined,
        },
      },
    });

    expect(issueKeys(report.issues)).toEqual([
      "missing:gpt-test:categories",
      "missing:gpt-test:contextTokens",
      "missing:gpt-test:distillable",
      "missing:gpt-test:modalities",
      "missing:gpt-test:providers",
      "missing:gpt-test:releasedAt",
      "missing:gpt-test:vendor",
    ]);
    expectEveryIssueIsPendingAndFilterAffected(report.issues);
  });

  test("releasedAt uses strict calendar-date validation", () => {
    const invalid = audit({
      metadata: {
        "gpt-test": {
          ...COMPLETE_META,
          releasedAt: "2026-02-31",
        },
      },
    });
    expect(issueKeys(invalid.issues)).toEqual(["invalid:gpt-test:releasedAt"]);

    const validLeap = audit({
      metadata: {
        "gpt-test": {
          ...COMPLETE_META,
          releasedAt: "2024-02-29",
        },
      },
    });
    expect(validLeap.issues).toEqual([]);
  });

  test("invalid effective price and billing data are invalid issues", () => {
    const rows: AuditModelDirectoryRow[] = [
      { ...COMPLETE_ROW, name: "bad-billing", billingUnit: "seat" },
      { ...COMPLETE_ROW, name: "bad-input", inputFilterUsd: 0 },
      { ...COMPLETE_ROW, name: "bad-output", outputFilterUsd: Number.POSITIVE_INFINITY },
    ];
    const metadata = Object.fromEntries(rows.map((row) => [row.name, COMPLETE_META]));

    const report = audit({ rows, metadata });

    expect(issueKeys(report.issues)).toEqual([
      "invalid:bad-billing:billingUnit",
      "invalid:bad-input:inputFilterUsd",
      "invalid:bad-output:outputFilterUsd",
    ]);
    expectStatuses(report.issues, "invalid");
    expectEveryIssueIsPendingAndFilterAffected(report.issues);
  });

  test("whitespace-only string metadata is missing", () => {
    const report = audit({
      rows: [COMPLETE_ROW],
      metadata: { [COMPLETE_ROW.name]: { ...COMPLETE_META, vendor: "   ", series: "\t" } },
    });

    expect(report.issues.map((issue) => issue.field)).toEqual(["series", "vendor"]);
    expect(report.issues.map((issue) => issue.status)).toEqual(["missing", "missing"]);
    expect(report.issues.map((issue) => issue.currentValue)).toEqual(["\t", "   "]);
  });

  test("live model with no exact metadata entry is an unknown-model issue", () => {
    const report = audit({ metadata: {} });

    expect(issueKeys(report.issues)).toEqual(["unknown-model:gpt-test:metadata"]);
    expectEveryIssueIsPendingAndFilterAffected(report.issues);
  });

  test("metadata entry with no live exact-name model is a stale-metadata issue", () => {
    const report = audit({
      metadata: {
        [COMPLETE_ROW.name]: COMPLETE_META,
        "retired-model": COMPLETE_META,
      },
    });

    expect(issueKeys(report.issues)).toEqual(["stale-metadata:retired-model:metadata"]);
    expectEveryIssueIsPendingAndFilterAffected(report.issues);
  });

  test("duplicate exact identities and alias collisions are deterministic collision issues", () => {
    const report = audit({
      rows: [
        { ...COMPLETE_ROW, name: "same-name", vendor: "OpenAI" },
        { ...COMPLETE_ROW, name: "same-name", vendor: "Azure" },
        { ...COMPLETE_ROW, name: "alias-target", vendor: "OpenAI" },
      ],
      metadata: {
        "same-name": { ...COMPLETE_META, aliases: ["alias-target"] },
        "alias-target": { ...COMPLETE_META, vendor: "Azure" },
      },
    });

    expect(report.issues.map((issue) => ({ status: issue.status, kind: issue.kind, modelName: issue.modelName, field: issue.field }))).toEqual([
      { status: "invalid", kind: "collision", modelName: "alias-target", field: "identity" },
      { status: "invalid", kind: "collision", modelName: "same-name", field: "identity" },
    ]);
    expectEveryIssueIsPendingAndFilterAffected(report.issues);
  });

  test("same-name raw identities with same vendor but distinct modelIds collide", () => {
    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows: [{ ...COMPLETE_ROW, modelId: 102, name: "same-name", vendor: "OpenAI" }],
      identityRows: [
        { ...COMPLETE_ROW, modelId: 101, name: "same-name", vendor: "OpenAI" },
        { ...COMPLETE_ROW, modelId: 102, name: "same-name", vendor: "OpenAI" },
      ],
      metadata: { "same-name": COMPLETE_META },
    });

    expect(report.modelCount).toBe(1);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      status: "invalid",
      kind: "collision",
      field: "identity",
      modelName: "same-name",
      currentValue: [
        { modelId: 101, name: "same-name", vendor: "OpenAI" },
        { modelId: 102, name: "same-name", vendor: "OpenAI" },
      ],
    });
  });

  test("issue ordering is deterministic by status, model name, and field", () => {
    const first = audit({
      rows: [
        { ...COMPLETE_ROW, name: "z-live", inputFilterUsd: 0 },
        { ...COMPLETE_ROW, name: "a-live", billingUnit: "unknown" },
      ],
      metadata: {
        "z-live": COMPLETE_META,
        "a-live": COMPLETE_META,
        "m-stale": COMPLETE_META,
      },
    });
    const second = audit({
      rows: [
        { ...COMPLETE_ROW, name: "a-live", billingUnit: "unknown" },
        { ...COMPLETE_ROW, name: "z-live", inputFilterUsd: 0 },
      ],
      metadata: {
        "m-stale": COMPLETE_META,
        "a-live": COMPLETE_META,
        "z-live": COMPLETE_META,
      },
    });

    expect(issueKeys(first.issues)).toEqual([
      "invalid:a-live:billingUnit",
      "invalid:z-live:inputFilterUsd",
      "stale-metadata:m-stale:metadata",
    ]);
    expect(first.issues).toEqual(second.issues);
  });

  test("markdown contains read-only operator review warnings", () => {
    const markdown = renderModelDirectoryAuditMarkdown(audit({ metadata: {} }));

    expect(markdown).toContain("No production writes were performed");
    expect(markdown).toContain("Review these findings before any database update");
    expect(markdown).toContain("## Issue totals by severity");
    expect(markdown).toContain("## Issue totals by affected filter");
    expect(markdown).toContain("| unknown-model |");
    expect(markdown).toContain("| metadata |");
    expect(markdown).not.toContain("UPDATE ");
    expect(markdown).not.toContain("INSERT ");
  });

  test("suggestions are omitted unless trusted suggested value and source are supplied", () => {
    const report = audit({ metadata: {} });

    expect(report.issues[0]).not.toHaveProperty("suggestedValue");
    expect(report.issues[0]).not.toHaveProperty("source");
    expect(report.issues[0]).not.toHaveProperty("suggestedSource");
    expect(report.issues[0]).not.toHaveProperty("confidence");
    expect(report.issues[0]?.backfillSqlEligible).toBe(false);
  });

  test("trusted suggestions retain provenance and enable backfill eligibility metadata only", () => {
    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows: [{ ...COMPLETE_ROW, inputFilterUsd: undefined }],
      metadata: { [COMPLETE_ROW.name]: COMPLETE_META },
      suggestions: {
        "gpt-test:inputFilterUsd": {
          suggestedValue: 0.75,
          suggestedSource: "pricing payload display_pricing.gpt-test.input.plg",
          confidence: "high",
        },
      },
    });

    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      suggestedValue: 0.75,
      suggestedSource: "pricing payload display_pricing.gpt-test.input.plg",
      confidence: "high",
      backfillSqlEligible: true,
    });
    expect(report.issues[0]).not.toHaveProperty("source");
  });

  test("markdown renders suggestion evidence, affected filters, current value, and review status", () => {
    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows: [{ ...COMPLETE_ROW, inputFilterUsd: undefined }],
      metadata: { [COMPLETE_ROW.name]: COMPLETE_META },
      suggestions: {
        "gpt-test:inputFilterUsd": {
          suggestedValue: 0.75,
          suggestedSource: "pricing payload display_pricing.gpt-test.input.plg",
          confidence: "high",
        },
      },
    });

    const markdown = renderModelDirectoryAuditMarkdown(report);

    expect(markdown).toContain("inputPrice");
    expect(markdown).toContain("undefined");
    expect(markdown).toContain("pending");
    expect(markdown).toContain("0.75");
    expect(markdown).toContain("pricing payload display_pricing.gpt-test.input.plg");
    expect(markdown).toContain("high");
  });

  test("issues preserve production modelId from audit rows", () => {
    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows: [{ ...COMPLETE_ROW, modelId: 917, inputFilterUsd: undefined }],
      metadata: { [COMPLETE_ROW.name]: COMPLETE_META },
    });

    expect(report.issues[0]?.modelId).toBe("917");
  });

  test("JSON renderer preserves non-finite numbers explicitly", () => {
    const report = audit({
      rows: [
        { ...COMPLETE_ROW, name: "bad-infinity", inputFilterUsd: Number.POSITIVE_INFINITY },
        { ...COMPLETE_ROW, name: "bad-negative-infinity", inputFilterUsd: Number.NEGATIVE_INFINITY },
        { ...COMPLETE_ROW, name: "bad-nan", inputFilterUsd: Number.NaN },
      ],
      metadata: {
        "bad-infinity": COMPLETE_META,
        "bad-negative-infinity": COMPLETE_META,
        "bad-nan": COMPLETE_META,
      },
    });

    const json = renderModelDirectoryAuditJson(report);

    expect(json).toContain('"currentValue": "Infinity"');
    expect(json).toContain('"currentValue": "-Infinity"');
    expect(json).toContain('"currentValue": "NaN"');
    expect(json).not.toContain('"currentValue": null');
  });

  test("JSON renderer preserves undefined current values explicitly", () => {
    const report = audit({ metadata: {} });

    const parsed = JSON.parse(renderModelDirectoryAuditJson(report));

    expect(parsed.issues[0]).toMatchObject({
      modelName: "gpt-test",
      field: "metadata",
      currentValue: "undefined",
    });
  });

  test("JSON renderer does not stringify nested undefined optional properties", () => {
    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows: [{ ...COMPLETE_ROW, name: "dup", vendor: "OpenAI" }],
      identityRows: [
        { name: "dup", vendor: "OpenAI" },
        { name: "dup", vendor: "Azure" },
      ],
      metadata: { dup: COMPLETE_META },
    });

    const parsed = JSON.parse(renderModelDirectoryAuditJson(report));

    expect(parsed.issues[0]).toMatchObject({
      modelName: "dup",
      field: "identity",
      currentValue: [
        { name: "dup", vendor: "OpenAI" },
        { name: "dup", vendor: "Azure" },
      ],
    });
    expect(parsed.issues[0].currentValue[0]).not.toHaveProperty("modelId");
    expect(parsed.issues[0].currentValue[1]).not.toHaveProperty("modelId");
  });
});

describe("model directory audit CLI assembly", () => {
  test("uses directory metadata attached by the database-backed pricing endpoint", () => {
    const assembled = assembleAuditCatalogFromPricingPayload({
      success: true,
      data: [{
        model_name: "gpt-test",
        quota_type: 0,
        model_ratio: 1,
        completion_ratio: 1,
        directory_metadata: {
          author: "OpenAI",
          providers: ["OpenAI"],
          modalities: ["text"],
          context_tokens: 128000,
          series: "GPT",
          categories: ["Programming"],
          released_at: "2026-08-01",
          distillable: false,
        },
      }],
    });

    expect(assembled.metadata["gpt-test"]).toEqual({
      vendor: "OpenAI",
      providers: ["OpenAI"],
      modalities: ["text"],
      contextTokens: 128000,
      series: "GPT",
      categories: ["Programming"],
      releasedAt: "2026-08-01",
      distillable: false,
    });
  });

  test("keeps live zero-priced catalogue records in the audit rows", () => {
    const rows = assembleAuditRowsFromPricingPayload({
      success: true,
      vendors: [{ id: 1, name: "Live Vendor" }],
      group_ratio: { plg: 0.9 },
      data: [
        {
          id: 101,
          model_name: "gpt-test",
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 0.5,
          completion_ratio: 2,
          enable_groups: ["plg"],
        },
        {
          id: 202,
          model_name: "unpriced-live",
          vendor_id: 1,
          quota_type: 1,
          model_ratio: 0,
          completion_ratio: 0,
          model_price: 0,
          enable_groups: ["plg"],
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.name === "unpriced-live")).toMatchObject({
      modelId: 202,
      name: "unpriced-live",
      vendor: "Live Vendor",
      billingUnit: "request",
      inputFilterUsd: 0,
      outputFilterUsd: 0,
    });

    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows,
      metadata: {
        "gpt-test": COMPLETE_META,
        "unpriced-live": COMPLETE_META,
      },
    });
    expect(report.modelCount).toBe(2);
    expect(issueKeys(report.issues)).toEqual([
      "invalid:unpriced-live:inputFilterUsd",
      "invalid:unpriced-live:outputFilterUsd",
    ]);
  });

  test("audits one coherent final duplicate row while preserving raw collision identities", () => {
    const assembled = assembleAuditCatalogFromPricingPayload({
      success: true,
      vendors: [
        { id: 1, name: "Hidden Provider" },
        { id: 2, name: "Displayed Provider" },
      ],
      group_ratio: { plg: 0.9 },
      data: [
        {
          id: 101,
          model_name: "gpt-4.1-mini",
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 0.2,
          completion_ratio: 4,
          enable_groups: ["plg"],
        },
        {
          id: 102,
          model_name: "gpt-4.1-mini",
          vendor_id: 2,
          quota_type: 0,
          model_ratio: 0.3,
          completion_ratio: 4,
          enable_groups: ["plg"],
        },
      ],
    });

    expect(assembled.rows).toEqual([
      {
        modelId: 102,
        name: "gpt-4.1-mini",
        vendor: "Displayed Provider",
        billingUnit: "token",
        inputFilterUsd: 0.54,
        outputFilterUsd: 2.16,
      },
    ]);
    expect(assembled.identityRows.map((row) => ({ modelId: row.modelId, vendor: row.vendor }))).toEqual([
      { modelId: 101, vendor: "Hidden Provider" },
      { modelId: 102, vendor: "Displayed Provider" },
    ]);

    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows: assembled.rows,
      identityRows: assembled.identityRows,
      metadata: { "gpt-4.1-mini": COMPLETE_META },
    });

    expect(report.modelCount).toBe(1);
    expect(report.issues.map((issue) => ({ kind: issue.kind, field: issue.field, modelName: issue.modelName }))).toEqual([
      { kind: "collision", field: "identity", modelName: "gpt-4.1-mini" },
    ]);
  });

  test("preserves token billing and valid input when only output pricing is zero", () => {
    const rows = assembleAuditRowsFromPricingPayload({
      success: true,
      vendors: [{ id: 1, name: "Live Vendor" }],
      group_ratio: { plg: 0.9 },
      data: [
        {
          id: 401,
          model_name: "input-only-token",
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 0.5,
          completion_ratio: 0,
          enable_groups: ["plg"],
        },
      ],
    });

    expect(rows).toEqual([
      {
        modelId: 401,
        name: "input-only-token",
        vendor: "Live Vendor",
        billingUnit: "token",
        inputFilterUsd: 0.9,
        outputFilterUsd: 0,
        outputPriceZeroAllowed: true,
      },
    ]);

    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows,
      metadata: { "input-only-token": COMPLETE_META },
    });

    expect(report.issues).toEqual([]);
  });

  test("accepts zero output pricing for an explicitly input-only model", () => {
    const report = audit({
      rows: [{ ...COMPLETE_ROW, outputFilterUsd: 0, outputPriceZeroAllowed: true }],
    });

    expect(report.issues).toEqual([]);
  });

  test("preserves display-priced zero as invalid current value instead of missing", () => {
    const rows = assembleAuditRowsFromPricingPayload({
      success: true,
      vendors: [{ id: 1, name: "Live Vendor" }],
      group_ratio: { plg: 0.9 },
      display_pricing: {
        "zero-display-request": {
          billing_kind: "request",
          prices: {
            request: { configured: 0, plg: 0 },
          },
        },
      },
      data: [
        {
          id: 402,
          model_name: "zero-display-request",
          vendor_id: 1,
          quota_type: 1,
          model_ratio: 0,
          completion_ratio: 0,
          model_price: 0,
          enable_groups: ["plg"],
        },
      ],
    });

    expect(rows).toEqual([
      {
        modelId: 402,
        name: "zero-display-request",
        vendor: "Live Vendor",
        billingUnit: "request",
        inputFilterUsd: 0,
        outputFilterUsd: 0,
      },
    ]);

    const report = auditModelDirectoryCatalog({
      generatedAt: "2026-08-21T00:00:00.000Z",
      source: "fixture",
      rows,
      metadata: { "zero-display-request": COMPLETE_META },
    });

    expect(issueKeys(report.issues)).toEqual([
      "invalid:zero-display-request:inputFilterUsd",
      "invalid:zero-display-request:outputFilterUsd",
    ]);
    expect(report.issues.map((issue) => issue.currentValue)).toEqual([0, 0]);
  });

  test("carries usable ids for malformed records while continuing valid rows", () => {
    const rows = assembleAuditRowsFromPricingPayload({
      success: true,
      vendors: [{ id: 1, name: "Live Vendor" }],
      group_ratio: { plg: 0.9 },
      data: [
        {
          id: 301,
          model_name: "malformed-live",
          vendor_id: 1,
          quota_type: "token",
          model_ratio: 0.2,
          completion_ratio: 4,
        },
        {
          id: 302,
          model_name: "gpt-test",
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 0.5,
          completion_ratio: 2,
          enable_groups: ["plg"],
        },
      ],
    });

    expect(rows.map((row) => ({ modelId: row.modelId, name: row.name }))).toEqual([
      { modelId: 302, name: "gpt-test" },
      { modelId: 301, name: "malformed-live" },
    ]);
  });
});

describe("model directory audit CLI runner", () => {
	test("audits the full pricing scope by default", async () => {
		let fetchedUrl = "";

    await runModelDirectoryAuditCli({
      env: { APP_CONSOLE_ORIGIN: "https://console.test", MODEL_DIRECTORY_AUDIT_OUT_DIR: "tmp/audit" },
      fetchImpl: async (input) => {
        fetchedUrl = String(input);
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      },
      mkdirImpl: async () => {},
      writeFileImpl: async () => {},
      logImpl: () => {},
      now: () => new Date("2026-08-21T00:00:00.000Z"),
    });

		expect(fetchedUrl).toBe("https://console.test/api/website/pricing");
	});

	test("uses an explicit group when the audit scope is configured", async () => {
		let fetchedUrl = "";
		const writtenPaths: string[] = [];

		await runModelDirectoryAuditCli({
			env: {
				APP_CONSOLE_ORIGIN: "https://console.test",
				MODEL_DIRECTORY_AUDIT_GROUP: "plg",
				MODEL_DIRECTORY_AUDIT_OUT_DIR: "tmp/audit",
			},
			fetchImpl: async (input) => {
				fetchedUrl = String(input);
				return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
			},
			mkdirImpl: async () => {},
			writeFileImpl: async (path) => {
				writtenPaths.push(String(path));
			},
			logImpl: () => {},
			now: () => new Date("2026-08-21T00:00:00.000Z"),
		});

		expect(fetchedUrl).toBe("https://console.test/api/website/pricing?group=plg");
		expect(writtenPaths.map((path) => path.replaceAll("\\", "/"))).toEqual([
			"tmp/audit/production-model-directory-audit-plg.json",
			"tmp/audit/production-model-directory-audit-plg.md",
		]);
	});

	test("rejects unsupported audit groups before fetching or writing", async () => {
		const calls: string[] = [];

		await expect(
			runModelDirectoryAuditCli({
				env: { APP_CONSOLE_ORIGIN: "https://console.test", MODEL_DIRECTORY_AUDIT_GROUP: "internal" },
				fetchImpl: async () => {
					calls.push("fetch");
					return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
				},
				mkdirImpl: async () => {
					calls.push("mkdir");
				},
				writeFileImpl: async () => {
					calls.push("write");
				},
			})
		).rejects.toThrow("unsupported audit group");

		expect(calls).toEqual([]);
	});

  test("rejects non-ok pricing fetch without writing or logging success", async () => {
    const calls: string[] = [];

    await expect(
      runModelDirectoryAuditCli({
        env: { APP_CONSOLE_ORIGIN: "https://console.test", MODEL_DIRECTORY_AUDIT_OUT_DIR: "tmp/audit" },
        fetchImpl: async () => new Response("nope", { status: 503 }),
        mkdirImpl: async () => {
          calls.push("mkdir");
        },
        writeFileImpl: async () => {
          calls.push("write");
        },
        logImpl: () => {
          calls.push("log");
        },
        now: () => new Date("2026-08-21T00:00:00.000Z"),
      })
    ).rejects.toThrow("pricing fetch failed: 503");

    expect(calls).toEqual([]);
  });

  test("rejects missing console origin without fetching or writing", async () => {
    const calls: string[] = [];

    await expect(
      runModelDirectoryAuditCli({
        env: {},
        fetchImpl: async () => {
          calls.push("fetch");
          return new Response(null, { status: 200 });
        },
        mkdirImpl: async () => {
          calls.push("mkdir");
        },
        writeFileImpl: async () => {
          calls.push("write");
        },
        logImpl: () => {
          calls.push("log");
        },
      })
    ).rejects.toThrow("APP_CONSOLE_ORIGIN is required");

    expect(calls).toEqual([]);
  });
});

function expectEveryIssueIsPendingAndFilterAffected(issues: AuditIssue[]) {
  expect(issues.length).toBeGreaterThan(0);
  for (const issue of issues) {
    expect(issue.reviewStatus).toBe("pending");
    expect(issue.affectedFilters.length).toBeGreaterThan(0);
    expect(issue.backfillSqlEligible).toBe(false);
  }
}

function expectStatuses(issues: AuditIssue[], status: AuditIssueStatus) {
  expect(issues.every((issue) => issue.status === status)).toBe(true);
}
