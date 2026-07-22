const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildSkillPayload,
  normalizeEvaluation,
  normalizeSort,
  normalizeTestcases,
  readManifest,
  resolveUploadSort,
} = require("./upload.js");

const evaluation = {
  overallScore: null,
  overallRating: " Good ",
  overallReview: " Review ",
  dimensions: {
    safety: { score: 4.8, review: " Safe " },
    access: { score: 4.5, review: " Scoped " },
    frontier: { score: 4.4, review: " Modern " },
    economy: { score: 4.0, review: " Efficient " },
  },
};

test("zero and omitted sort values upload as the default tail sort", () => {
  assert.equal(normalizeSort(undefined), 0);
  assert.equal(resolveUploadSort(normalizeSort(undefined)), 1_000_000);
  assert.equal(resolveUploadSort(normalizeSort(0)), 1_000_000);
  assert.equal(resolveUploadSort(normalizeSort(25)), 25);
  assert.throws(() => normalizeSort("0"), /safe integer/);
  assert.throws(() => normalizeSort(1.5), /safe integer/);
});

test("evaluation uses and normalizes the current four dimensions", () => {
  const normalized = normalizeEvaluation(evaluation);
  assert.equal(normalized.overallRating, "Good");
  assert.equal(normalized.dimensions.safety.review, "Safe");
  assert.deepEqual(Object.keys(normalized.dimensions), [
    "safety",
    "access",
    "frontier",
    "economy",
  ]);
  assert.throws(
    () =>
      normalizeEvaluation({
        dimensions: {
          trust: { score: 4 },
          reliability: { score: 4 },
          adaptability: { score: 4 },
          convention: { score: 4 },
          effectiveness: { score: 4 },
        },
      }),
    /dimensions\.safety is required/,
  );
});

test("testcases are normalized and validated", () => {
  const normalized = normalizeTestcases({
    slug: " demo ",
    testcases: [
      { id: 1, question: " Question ", answer: " Answer ", sortOrder: 2 },
    ],
  });
  assert.deepEqual(normalized, {
    slug: "demo",
    testcases: [
      { id: 1, question: "Question", answer: "Answer", sortOrder: 2 },
    ],
  });
  assert.throws(
    () =>
      normalizeTestcases({
        slug: "demo",
        testcases: [{ id: 1, question: "", answer: "Answer", sortOrder: 2 }],
      }),
    /question is required/,
  );
});

test("manifest testcases paths are loaded relative to the manifest", async (t) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "skill-upload-"));
  t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const testcasesPath = path.join(directory, "demo.testcases.json");
  const manifestPath = path.join(directory, "manifest.json");
  await fsp.writeFile(
    testcasesPath,
    JSON.stringify({
      slug: "demo",
      testcases: [
        { id: 1, question: "Question", answer: "Answer", sortOrder: 0 },
      ],
    }),
    "utf8",
  );
  await fsp.writeFile(
    manifestPath,
    JSON.stringify([
      {
        id: "Demo.Skill_1",
        name: "Demo",
        zip: "./packages/demo.zip",
        sort: 0,
        evaluation,
        testcases: "./demo.testcases.json",
      },
    ]),
    "utf8",
  );

  const entries = await readManifest(manifestPath);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].errors, []);
  assert.equal(entries[0].testcasesPath, testcasesPath);
  assert.equal(entries[0].testcases.testcases.length, 1);

  const payload = buildSkillPayload(
    entries[0],
    {
      url: "https://example.com/demo.zip",
      object: "tmp/demo.zip",
      checksum: "sha256:demo",
    },
    null,
  );
  assert.equal(payload.sort, 1_000_000);
  assert.equal(payload.testcases.slug, "demo");
});

test("inline testcases objects are rejected by the manifest contract", async (t) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "skill-upload-"));
  t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const manifestPath = path.join(directory, "manifest.json");
  await fsp.writeFile(
    manifestPath,
    JSON.stringify([
      {
        id: "demo",
        name: "Demo",
        zip: "./demo.zip",
        testcases: { slug: "demo", testcases: [] },
      },
    ]),
    "utf8",
  );

  const entries = await readManifest(manifestPath);
  assert.match(entries[0].errors.join("; "), /local JSON file path/);
});
