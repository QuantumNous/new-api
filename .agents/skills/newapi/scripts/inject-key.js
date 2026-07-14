/**
 * Secure token key writer for config files.
 *
 * Two modes:
 *
 * Scan mode:   inject-key.js --scan <file_path>
 *   Outputs file content with sensitive values redacted so the AI can
 *   understand structure without seeing real keys.
 *
 * Apply mode:  inject-key.js <token_id> <file_path>
 *   Fetches the real key for token_id, replaces __NEWAPI_TOKEN_{id}__
 *   placeholder in the file with the real key, and atomically replaces
 *   the target file. The key never appears on stdout or stderr.
 *
 * Exit codes:
 *   0 — success
 *   1 — usage / network / file error
 *   2 — config missing (from env.js)
 */

const fs = require("fs");
const path = require("path");
const { sanitize } = require("./sanitize");

// --- Atomic file write helper ---

function buildTempPath(targetPath) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  return path.join(dir, `.${base}.newapi-${process.pid}-${Date.now()}.tmp`);
}

function writeFileAtomically(targetPath, content) {
  const tempPath = buildTempPath(targetPath);
  const stats = fs.statSync(targetPath);

  try {
    fs.writeFileSync(tempPath, content, { encoding: "utf-8", mode: stats.mode });
    fs.renameSync(tempPath, targetPath);
  } catch {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {}

    throw new Error(
      `Failed to safely replace ${targetPath}. The original file was left untouched.`
    );
  }
}

// --- Scan mode (no API config needed) ---

if (process.argv[2] === "--scan") {
  const filePath = process.argv[3];
  if (!filePath) {
    console.error("Usage: inject-key.js --scan <file_path>");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`ERROR: File not found: ${resolved}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, "utf-8");
  console.log(sanitize(content));
  process.exit(0);
}

// --- Apply mode ---

const { BASE_URL, ACCESS_TOKEN, USER_ID } = require("./env");
const { fetchTokenKey } = require("./fetch-key");

const tokenId = process.argv[2];
const filePath = process.argv[3];

if (!tokenId || !/^\d+$/.test(tokenId) || !filePath) {
  console.error("Usage: inject-key.js <token_id> <file_path>");
  console.error("       inject-key.js --scan <file_path>");
  process.exit(1);
}

const placeholder = `__NEWAPI_TOKEN_${tokenId}__`;

async function main() {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`ERROR: File not found: ${resolved}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, "utf-8");

  if (!content.includes(placeholder)) {
    console.error(`ERROR: Placeholder ${placeholder} not found in ${filePath}`);
    process.exit(1);
  }

  let fullKey;
  try {
    fullKey = await fetchTokenKey(tokenId, {
      baseUrl: BASE_URL,
      accessToken: ACCESS_TOKEN,
      userId: USER_ID,
    });
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }

  const updated = content.split(placeholder).join(fullKey);

  try {
    writeFileAtomically(resolved, updated);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }

  console.log(`已将 Token ${tokenId} 的密钥写入 ${filePath}`);
}

main().catch(() => {
  console.error("ERROR: Unexpected failure");
  process.exit(1);
});
