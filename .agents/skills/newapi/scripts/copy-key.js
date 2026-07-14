/**
 * Secure token-key-to-clipboard copier for new-api
 * Usage: <runtime> copy-key.js <token_id>
 *
 * Fetches the real key for the given token and copies it directly to the
 * system clipboard. The key NEVER appears on stdout or stderr — it is
 * written exclusively through a child-process pipe to the clipboard
 * utility, so it cannot be captured by the calling LLM context.
 *
 * Exit codes:
 *   0 — success (key copied)
 *   1 — usage / config / network error
 */

const { execSync } = require("child_process");
const { BASE_URL, ACCESS_TOKEN, USER_ID } = require("./env");
const { fetchTokenKey } = require("./fetch-key");

// --- Args ---

const tokenId = process.argv[2];
if (!tokenId || !/^\d+$/.test(tokenId)) {
  console.error("Usage: copy-key.js <token_id>  (token_id must be a number)");
  process.exit(1);
}

// --- Clipboard utility detection ---

function detectClipboard() {
  if (process.platform === "darwin") return "pbcopy";
  try {
    execSync("command -v xclip", { stdio: "ignore" });
    return "xclip -selection clipboard";
  } catch {}
  try {
    execSync("command -v xsel", { stdio: "ignore" });
    return "xsel --clipboard --input";
  } catch {}
  return null;
}

// --- Main ---

async function main() {
  const clipCmd = detectClipboard();
  if (!clipCmd) {
    console.error("ERROR: No clipboard utility found (need pbcopy / xclip / xsel)");
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

  try {
    execSync(clipCmd, { input: fullKey, stdio: ["pipe", "ignore", "ignore"] });
  } catch {
    console.error("ERROR: Failed to write to clipboard");
    process.exit(1);
  }

  console.log(`Token ${tokenId} 的密钥已复制到剪贴板。`);
}

main().catch(() => {
  console.error("ERROR: Unexpected failure");
  process.exit(1);
});
