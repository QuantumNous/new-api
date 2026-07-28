import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const installer = path.join(repoRoot, "website-static/html/install.sh");
const nginxConfig = path.join(repoRoot, "website-static/nginx.conf");

test("the public CLI and skill artifacts use agent-readable content types", async () => {
  const nginx = await readFile(nginxConfig, "utf8");
  assert.match(nginx, /location = \/SKILL\.md \{ default_type text\/markdown;/);
  assert.match(nginx, /location = \/install\.sh \{ default_type text\/plain;/);
});

test("the CLI installer preserves existing Codex config and isolates the Flatkey profile", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flatkey-installer-"));
  const home = path.join(root, "home");
  const bin = path.join(root, "bin");
  const codexDir = path.join(home, ".codex");
  const originalConfig = 'model = "user-model"\n';
  const testKey = "sk-fk-installer-test-only";

  await mkdir(bin, { recursive: true });
  await mkdir(codexDir, { recursive: true });
  await writeFile(path.join(home, ".zshrc"), "# user shell config\n");
  await writeFile(path.join(codexDir, "config.toml"), originalConfig);
  await writeFile(path.join(bin, "curl"), "#!/usr/bin/env bash\nexit 0\n");
  await chmod(path.join(bin, "curl"), 0o755);

  const result = spawnSync("bash", [installer], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH}`,
      FLATKEY_AGENT: "codex",
      FLATKEY_API_KEY: testKey,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(await readFile(path.join(codexDir, "config.toml"), "utf8"), originalConfig);

  const profile = await readFile(path.join(codexDir, "flatkey.config.toml"), "utf8");
  assert.match(profile, /model_provider = "flatkey"/);
  assert.match(profile, /wire_api = "responses"/);

  const envFile = path.join(home, ".config/flatkey/env");
  assert.match(await readFile(envFile, "utf8"), /FLATKEY_API_KEY=/);
  assert.equal((await stat(envFile)).mode & 0o777, 0o600);

  const shellConfig = await readFile(path.join(home, ".zshrc"), "utf8");
  assert.match(shellConfig, /\.config\/flatkey\/env/);
  assert.doesNotMatch(shellConfig, new RegExp(testKey));
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(testKey));
  assert.match(result.stdout, /codex -p flatkey/);
});
