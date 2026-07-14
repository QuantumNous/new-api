/**
 * Secure command executor with token placeholder replacement.
 *
 * Usage: exec-token.js <token_id> -- <command with __NEWAPI_TOKEN_{id}__>
 *
 * Fetches the real key for token_id, replaces the placeholder in the
 * command string, executes the command in a child shell, and returns
 * sanitized output. The real key never appears in this script's own
 * stdout, stderr, or argv.
 *
 * Exit codes:
 *   0   — child command succeeded
 *   1   — usage / network / placeholder error
 *   2   — config missing (from env.js)
 *   N   — child command exit code (propagated)
 */

const { execSync } = require("child_process");
const { BASE_URL, ACCESS_TOKEN, USER_ID } = require("./env");
const { fetchTokenKey } = require("./fetch-key");
const { sanitize } = require("./sanitize");

// --- Parse args ---

const dashIdx = process.argv.indexOf("--");
const tokenId = process.argv[2];

if (!tokenId || !/^\d+$/.test(tokenId) || dashIdx < 3 || dashIdx + 1 >= process.argv.length) {
  console.error("Usage: exec-token.js <token_id> -- <command with __NEWAPI_TOKEN_{id}__ placeholder>");
  console.error("Example: exec-token.js 42 -- openclaw config set apiKey __NEWAPI_TOKEN_42__");
  process.exit(1);
}

const commandParts = process.argv.slice(dashIdx + 1);
const commandTemplate = commandParts.join(" ");
const placeholder = `__NEWAPI_TOKEN_${tokenId}__`;

if (!commandTemplate.includes(placeholder)) {
  console.error(`ERROR: Placeholder ${placeholder} not found in command: ${commandTemplate}`);
  process.exit(1);
}

// --- Main ---

async function main() {
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

  const realCommand = commandTemplate.split(placeholder).join(fullKey);

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    stdout = execSync(realCommand, {
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
      encoding: "utf-8",
      timeout: 30000,
    });
  } catch (error) {
    exitCode = error.status || 1;
    stdout = error.stdout || "";
    stderr = error.stderr || "";
  }

  if (stdout) {
    process.stdout.write(sanitize(stdout));
  }
  if (stderr) {
    process.stderr.write(sanitize(stderr));
  }

  process.exit(exitCode);
}

main().catch(() => {
  console.error("ERROR: Unexpected failure");
  process.exit(1);
});
