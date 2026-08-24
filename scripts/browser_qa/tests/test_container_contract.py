import pathlib
import re
import subprocess
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
DOCKERFILE = REPO_ROOT / "scripts" / "browser_qa" / "Dockerfile"
ENTRYPOINT = REPO_ROOT / "scripts" / "browser_qa" / "entrypoint.sh"
DOCKERIGNORE = REPO_ROOT / ".dockerignore"
QA_PROMPT = REPO_ROOT / "scripts" / "browser_qa" / "config" / "qa-prompt.md"
FIXED_CASES = REPO_ROOT / "scripts" / "browser_qa" / "fixed-cases"
STAGING_POLICY = REPO_ROOT / ".agents" / "skills" / "flatkey-new-user-onboarding" / "references" / "staging-cloud-qa-policy.md"
STAGING_SCENARIOS = REPO_ROOT / ".agents" / "skills" / "flatkey-new-user-onboarding" / "tests" / "staging-cloud-qa-scenarios.md"

BASE_IMAGE = (
    "node:22.23.2-bookworm-slim@"
    "sha256:f32b81066cde10a75dbac96646099533316d94bac4150c55da1636e1f0ffdc46"
)
NODE_ROOT = "/opt/flatkey-browser-qa"
PINNED_NPM_PACKAGES = {
    "@openai/codex": "0.146.0",
    "@playwright/mcp": "0.0.78",
    "playwright": "1.62.0-alpha-1783623505000",
    "playwright-core": "1.62.0-alpha-1783623505000",
}


def read(path):
    return path.read_text(encoding="utf-8")


def read_bytes(path):
    return path.read_bytes()


def significant_docker_lines():
    return [
        line.strip()
        for line in read(DOCKERFILE).splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


class ContainerContractTests(unittest.TestCase):
    def test_dockerfile_uses_exact_base_digest_and_exact_local_npm_pins(self):
        text = read(DOCKERFILE)
        self.assertRegex(text, rf"(?m)^FROM {re.escape(BASE_IMAGE)}$")
        self.assertIn(f"WORKDIR {NODE_ROOT}", text)
        self.assertIn("npm install", text)
        self.assertIn("--prefix /opt/flatkey-browser-qa", text)
        for package, version in PINNED_NPM_PACKAGES.items():
            self.assertRegex(text, rf"(?<![\w/@.-]){re.escape(package)}@{re.escape(version)}(?![\w.-])")
        self.assertIn("/opt/flatkey-browser-qa/node_modules", text)
        self.assertNotRegex(text, r"(?m)^\s*ENV\s+NODE_PATH\b")
        self.assertNotIn("npm install -g", text)
        self.assertNotIn("@latest", text)
        self.assertNotRegex(text, r"\bnpx\s+--yes\b")

    def test_dockerfile_installs_matching_chromium_for_non_root_runtime(self):
        text = read(DOCKERFILE)
        self.assertIn("PLAYWRIGHT_BROWSERS_PATH=/opt/flatkey-browser-qa/ms-playwright", text)
        self.assertIn("CHROMIUM_EXECUTABLE_PATH=/opt/flatkey-browser-qa/ms-playwright/chromium", text)
        self.assertIn("CHROMIUM_EXECUTABLE_PATH=/opt/flatkey-browser-qa/ms-playwright/chromium/chrome-linux64/chrome", text)
        self.assertIn("CHROMIUM_PATH=${CHROMIUM_EXECUTABLE_PATH}", text)
        self.assertRegex(text, r"(?m)^ENV CHROMIUM_PATH=\$\{CHROMIUM_EXECUTABLE_PATH\}$")
        self.assertLess(text.index("CHROMIUM_EXECUTABLE_PATH="), text.index("ENV CHROMIUM_PATH="))
        self.assertRegex(text, r"npx --no-install playwright install chromium")
        self.assertRegex(text, r"npx --no-install playwright install-deps chromium")
        self.assertRegex(text, r"chmod -R a\+rX /opt/flatkey-browser-qa/(node_modules|ms-playwright)")
        self.assertRegex(text, r"USER\s+(?!root\b)[A-Za-z_][A-Za-z0-9_-]*")

    def test_dockerfile_exposes_codex_and_playwright_mcp_without_runtime_npx(self):
        text = read(DOCKERFILE)
        self.assertRegex(text, r"ln -s /opt/flatkey-browser-qa/node_modules/.bin/codex /usr/local/bin/codex")
        self.assertRegex(text, r"ln -s /opt/flatkey-browser-qa/node_modules/.bin/playwright-mcp /usr/local/bin/playwright-mcp")
        self.assertRegex(text, r"&& codex --version")
        self.assertRegex(text, r"&& playwright-mcp --version")

    def test_dockerfile_copy_allowlist_excludes_repo_and_credential_paths(self):
        lines = significant_docker_lines()
        copy_lines = [line for line in lines if line.startswith("COPY ")]
        self.assertTrue(copy_lines)
        for line in copy_lines:
            tokens = line.split()
            sources = [token for token in tokens[1:-1] if not token.startswith("--")]
            self.assertNotIn(".", sources)
            self.assertNotIn("./", sources)
            self.assertNotIn("Gmail", line)
            self.assertNotIn(".codex", line)
            self.assertNotIn("auth.json", line)
            self.assertNotIn("client_secret", line)
            self.assertNotIn("oauth", line.lower())
            self.assertNotIn("cookie", line.lower())
        allowed_sources = {
            "scripts/browser_qa/flatkey_browser_qa",
            "scripts/browser_qa/config",
            "scripts/browser_qa/fixed-cases",
            "scripts/browser_qa/tests",
            "scripts/browser_qa/entrypoint.sh",
            ".agents/skills/flatkey-new-user-onboarding/SKILL.md",
            ".agents/skills/flatkey-new-user-onboarding/references",
            ".agents/skills/flatkey-new-user-onboarding/agents",
            ".agents/skills/flatkey-new-user-onboarding/tests",
        }
        for line in copy_lines:
            tokens = line.split()
            sources = [token for token in tokens[1:-1] if not token.startswith("--")]
            for source in sources:
                self.assertIn(source.rstrip("/"), allowed_sources)

    def test_dockerfile_copies_only_fixed_case_directory_with_current_disabled_fixtures(self):
        text = read(DOCKERFILE)
        self.assertIn("COPY scripts/browser_qa/fixed-cases scripts/browser_qa/fixed-cases", text)
        self.assertNotIn("COPY scripts/browser_qa scripts/browser_qa", text)
        self.assertNotIn("COPY . .", text)
        self.assertEqual(
            sorted(path.name for path in FIXED_CASES.glob("*.yaml")),
            ["FQA-0001-sign-in-route.yaml", "FQA-0002-sign-up-entry.yaml"],
        )
        for path in FIXED_CASES.glob("*.yaml"):
            self.assertIn("enabled: false", read(path))

    def test_entrypoint_selects_only_browser_qa_exec_modes_and_fails_fast(self):
        text = read(ENTRYPOINT)
        self.assertTrue(text.startswith("#!/bin/sh\n"))
        self.assertIn('mode="${1:-main}"', text)
        self.assertIn('exec python3 -m scripts.browser_qa.flatkey_browser_qa.supervisor', text)
        self.assertIn('exec python3 -m scripts.browser_qa.flatkey_browser_qa.cleanup_job', text)
        self.assertIn('exec python3 -m scripts.browser_qa.flatkey_browser_qa.broker', text)
        self.assertIn('exec python3 -m scripts.browser_qa.flatkey_browser_qa.candidate_job', text)
        self.assertNotIn("broker_mcp", text)
        self.assertRegex(text, r"\*\)\s*\n\s*echo .*unknown.*>&2\s*\n\s*exit 2", re.S)

    def test_entrypoint_blob_is_lf_only_for_linux_shebang(self):
        raw = read_bytes(ENTRYPOINT)
        self.assertTrue(raw.startswith(b"#!/bin/sh\n"))
        self.assertNotIn(b"\r\n", raw)
        indexed = subprocess.check_output(["git", "show", ":scripts/browser_qa/entrypoint.sh"], cwd=REPO_ROOT)
        self.assertTrue(indexed.startswith(b"#!/bin/sh\n"))
        self.assertNotIn(b"\r\n", indexed)

    def test_dockerfile_uses_entrypoint_with_executable_permission_contract(self):
        text = read(DOCKERFILE)
        self.assertIn("COPY --chmod=0755 scripts/browser_qa/entrypoint.sh /usr/local/bin/flatkey-browser-qa-entrypoint", text)
        self.assertIn('ENTRYPOINT ["/usr/local/bin/flatkey-browser-qa-entrypoint"]', text)
        self.assertIn('CMD ["main"]', text)

    def test_dockerfile_provides_top_level_tests_path_without_duplicate_copy(self):
        text = read(DOCKERFILE)
        self.assertIn("ln -s /opt/flatkey-browser-qa/scripts/browser_qa/tests /opt/flatkey-browser-qa/tests", text)
        self.assertLess(text.index("ln -s /opt/flatkey-browser-qa/scripts/browser_qa/tests"), text.index("USER flatkeyqa"))
        self.assertEqual(text.count("COPY scripts/browser_qa/tests scripts/browser_qa/tests"), 1)
        self.assertNotIn("COPY scripts/browser_qa/tests tests", text)

    def test_container_includes_bounded_ai_policy_and_scenario_contract(self):
        dockerfile = read(DOCKERFILE)
        self.assertIn("COPY scripts/browser_qa/config scripts/browser_qa/config", dockerfile)
        self.assertIn("COPY scripts/browser_qa/fixed-cases scripts/browser_qa/fixed-cases", dockerfile)
        self.assertIn(
            "COPY .agents/skills/flatkey-new-user-onboarding/references .agents/skills/flatkey-new-user-onboarding/references",
            dockerfile,
        )
        self.assertIn(
            "COPY .agents/skills/flatkey-new-user-onboarding/tests .agents/skills/flatkey-new-user-onboarding/tests",
            dockerfile,
        )

        qa_prompt = read(QA_PROMPT)
        self.assertIn(
            "Write each finding `title` in concise Simplified Chinese. Keep required product names, UI labels, URLs, and HTTP status codes unchanged. Do not translate or expose credentials, verification data, cookies, authorization values, query strings, or fragments.",
            qa_prompt,
        )

        combined_contract = "\n".join([qa_prompt, read(STAGING_POLICY), read(STAGING_SCENARIOS)])
        for required in [
            "core_body = recorded replay -> qa_replay_checkpoint (synchronously completes runtime fixed cases)",
            "core = core_body -> no exploration -> terminal cleanup/report",
            "normal = core_body -> qa_start_exploration -> bounded exploration -> terminal cleanup/report",
            "normal includes the complete core replay",
            "qa_start_exploration exactly once after qa_replay_checkpoint succeeds",
            "Do not explore before qa_replay_checkpoint",
            "Do not register a second account",
            "Do not create an extra API key",
            "Post-checkpoint exploration allows only navigation, read-only inspection, and non-submitting field, dialog, or client-side validation checks",
            "Do not submit, confirm, save, create, delete, resend, register, logout, or trigger any server state change after qa_replay_checkpoint",
            "Recorded replay and independent runtime cleanup are the only server-write exceptions",
            "form validation/repeat actions/loading states are limited to non-submitting client-side observation",
            "hypothesis queue",
            "5 minutes",
            "30 browser actions",
            "screenshots/*.png",
            "browser/console.jsonl",
            "browser/network.jsonl",
            "environment observation/info",
            "`qa_replay_checkpoint` takes no arguments",
            "`qa_start_exploration` takes no arguments",
        ]:
            self.assertIn(required.lower(), combined_contract.lower())
        for forbidden in [
            r"call `qa_replay_checkpoint` with\b.*\brun id\b",
            r"call `qa_replay_checkpoint` with\b.*\bcurrent url\b",
            r"call `qa_start_exploration` with\b.*\brun id\b",
            r"call `qa_start_exploration` with\b.*\bcurrent url\b",
        ]:
            self.assertNotRegex(combined_contract.lower(), forbidden)
        self.assertNotIn(
            "core = complete recorded replay -> qa_replay_checkpoint -> no exploration -> runtime cleanup -> report",
            qa_prompt.lower(),
        )
        self.assertNotIn(
            "normal = complete recorded replay -> qa_replay_checkpoint -> qa_start_exploration -> bounded exploration -> runtime cleanup -> report",
            qa_prompt.lower(),
        )
        self.assertNotIn(
            "core = complete recorded replay -> qa_replay_checkpoint -> no exploration -> runtime cleanup -> report",
            read(STAGING_POLICY).lower(),
        )
        self.assertNotIn(
            "normal = complete recorded replay -> qa_replay_checkpoint -> qa_start_exploration -> bounded exploration -> runtime cleanup -> report",
            read(STAGING_POLICY).lower(),
        )
        self.assertNotIn(
            "core = complete recorded replay -> qa_replay_checkpoint -> no exploration -> runtime cleanup -> report",
            read(STAGING_SCENARIOS).lower(),
        )
        self.assertNotIn(
            "normal = complete recorded replay -> qa_replay_checkpoint -> qa_start_exploration -> bounded exploration -> runtime cleanup -> report",
            read(STAGING_SCENARIOS).lower(),
        )

        scenarios = read(STAGING_SCENARIOS).lower()
        for required in [
            "attempt second account",
            "attempt second key",
            "blocked gtm/mixpanel noise",
            "no-evidence claim",
            "duplicate finding",
            "same-origin 5xx with network evidence",
            "post-checkpoint submit attempt",
            "post-checkpoint resend attempt",
            "post-checkpoint register attempt",
        ]:
            self.assertIn(required, scenarios)
        for expected in ["stop", "reject", "downgrade", "dedupe", "report"]:
            self.assertIn(expected, scenarios)

    def test_dockerignore_allows_only_the_selected_markdown_skill_exception(self):
        lines = [line.strip() for line in read(DOCKERIGNORE).splitlines() if line.strip()]
        md_index = lines.index("*.md")
        exceptions = [line for line in lines if line.startswith("!")]
        self.assertIn("!.agents/skills/flatkey-new-user-onboarding/SKILL.md", exceptions)
        self.assertIn("!.agents/skills/flatkey-new-user-onboarding/references/*.md", exceptions)
        self.assertIn("!.agents/skills/flatkey-new-user-onboarding/tests/*.md", exceptions)
        for exception in exceptions:
            if exception.startswith("!.agents/skills/flatkey-new-user-onboarding"):
                self.assertGreater(lines.index(exception), md_index)
                self.assertNotIn("**", exception)
                self.assertNotEqual(exception, "!.agents/skills/flatkey-new-user-onboarding/")
        broad_markdown = [line for line in exceptions if line.endswith("*.md") and not line.startswith("!.agents/skills/flatkey-new-user-onboarding/")]
        self.assertEqual(broad_markdown, [])
        self.assertIn("!THIRD-PARTY-LICENSES.md", exceptions)

    def test_static_container_inputs_do_not_embed_secret_values(self):
        secret_patterns = [
            r"sk-[A-Za-z0-9_-]{8,}",
            r"ya29\.[A-Za-z0-9_-]+",
            r"refresh_token",
            r"client_secret",
            r"Cookie:",
            r"GMAIL_OAUTH_JSON=.*\{",
        ]
        combined = "\n".join(read(path) for path in [DOCKERFILE, ENTRYPOINT, DOCKERIGNORE])
        for pattern in secret_patterns:
            self.assertNotRegex(combined, pattern)


if __name__ == "__main__":
    unittest.main()
