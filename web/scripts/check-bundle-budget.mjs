/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DEFAULT_BUDGETS = {
  entryGzipKiB: 400,
};

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function budgetBytes(budgetKiB, name) {
  if (budgetKiB === undefined) return undefined;
  if (!Number.isFinite(budgetKiB) || budgetKiB <= 0) {
    throw new Error(`${name} must be a positive number of KiB`);
  }
  return budgetKiB * 1024;
}

function assertWithinBudget(label, asset, budgetKiB) {
  const limit = budgetBytes(budgetKiB, `${label} budget`);
  if (limit === undefined) return;
  if (asset.gzipBytes > limit) {
    throw new Error(
      `${label} exceeds gzip budget by ${formatKiB(asset.gzipBytes - limit)}`,
    );
  }
}

export function assertBundleBudgets(stats, budgets) {
  assertWithinBudget("Entry bundle", stats.entry, budgets.entryGzipKiB);
  assertWithinBudget("Largest JS chunk", stats.largest, budgets.maxJsGzipKiB);
  assertWithinBudget(
    "Total JavaScript",
    { gzipBytes: stats.totalGzipBytes },
    budgets.totalJsGzipKiB,
  );
}

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listJavaScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function readAsset(projectRoot, assetPath) {
  const source = await readFile(assetPath);
  return {
    path: path
      .relative(path.join(projectRoot, "dist"), assetPath)
      .replaceAll("\\", "/"),
    gzipBytes: gzipSync(source, { level: 9 }).byteLength,
  };
}

async function readBudgets(projectRoot, configPath) {
  if (!configPath) return DEFAULT_BUDGETS;
  const config = JSON.parse(
    await readFile(path.resolve(projectRoot, configPath), "utf8"),
  );
  return { ...DEFAULT_BUDGETS, ...config };
}

async function collectBundleStats(projectRoot) {
  const distDir = path.join(projectRoot, "dist");
  const html = await readFile(path.join(distDir, "index.html"), "utf8");
  const entryMatch = html.match(
    /<script[^>]+src=["']([^"']*\/index\.[0-9a-f]+\.js)["']/i,
  );
  if (!entryMatch) {
    throw new Error(
      "Unable to locate the fingerprinted index bundle in dist/index.html",
    );
  }

  const files = await listJavaScriptFiles(path.join(distDir, "static", "js"));
  const assets = await Promise.all(
    files.map((file) => readAsset(projectRoot, file)),
  );
  if (assets.length === 0) {
    throw new Error("No JavaScript assets found in dist/static/js");
  }

  const entryPath = entryMatch[1].replace(/^\//, "");
  const entry = assets.find((asset) => asset.path === entryPath);
  if (!entry) {
    throw new Error(`Entry bundle ${entryPath} is missing from dist/static/js`);
  }
  const largest = assets.reduce((current, asset) =>
    asset.gzipBytes > current.gzipBytes ? asset : current,
  );
  return {
    entry,
    largest,
    totalGzipBytes: assets.reduce((total, asset) => total + asset.gzipBytes, 0),
  };
}

export async function runBundleBudgetCheck({
  projectRoot = process.cwd(),
  configPath,
} = {}) {
  const budgets = await readBudgets(projectRoot, configPath);
  const stats = await collectBundleStats(projectRoot);
  console.log(
    `Entry bundle ${stats.entry.path}: ${formatKiB(stats.entry.gzipBytes)} gzip (budget ${budgets.entryGzipKiB} KiB)`,
  );
  console.log(
    `Largest JS chunk ${stats.largest.path}: ${formatKiB(stats.largest.gzipBytes)} gzip${budgets.maxJsGzipKiB ? ` (budget ${budgets.maxJsGzipKiB} KiB)` : ""}`,
  );
  console.log(
    `Total JavaScript: ${formatKiB(stats.totalGzipBytes)} gzip${budgets.totalJsGzipKiB ? ` (budget ${budgets.totalJsGzipKiB} KiB)` : ""}`,
  );
  assertBundleBudgets(stats, budgets);
  return stats;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  await runBundleBudgetCheck({ configPath: process.argv[2] });
}
