import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CLAUDE_CODE_USE_CASE, CODEX_USE_CASE, IMAGE_BUDDY_QUICKSTART_STEPS, IMAGE_BUDDY_USE_CASE, getUseCaseConfig } from "@/components/coding-agent-use-case-page";
import { LOCALES } from "@/lib/locales";
import {
  CLAUDE_CODE_BASE_URL,
  CLAUDE_CODE_INSTALL_COMMANDS,
  CLAUDE_CODE_KEY_URL,
  CLAUDE_CODE_POSIX_INSTALL_SCRIPT,
  CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT,
  detectClaudeCodeInstallTab,
} from "./claude-code-use-case";

describe("Claude Code use-case install scripts", () => {
  test("configure Claude Code for the Flatkey router", () => {
    expect(CLAUDE_CODE_BASE_URL).toBe("https://router.flatkey.ai");
    expect(CLAUDE_CODE_KEY_URL).toBe("https://console.flatkey.ai/keys");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("export ANTHROPIC_BASE_URL");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("https://router.flatkey.ai");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("https://console.flatkey.ai/keys");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("ANTHROPIC_AUTH_TOKEN");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("export ANTHROPIC_API_KEY");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("ANTHROPIC_API_KEY: ''");
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain("ANTHROPIC_BASE_URL");
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain("https://router.flatkey.ai");
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain("https://console.flatkey.ai/keys");
    expect(`${CLAUDE_CODE_POSIX_INSTALL_SCRIPT}\n${CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT}`).not.toContain("chatgpttech");
  });

  test("lets users choose Claude Code or Codex CLI inside the installer", () => {
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("Which coding agent do you want to install?");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("@anthropic-ai/claude-code");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("@openai/codex");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain("https://router.flatkey.ai/v1");
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).toContain('model = "gpt-5.5"');
    expect(CLAUDE_CODE_POSIX_INSTALL_SCRIPT).not.toContain('model = "gpt-5"');
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain("Which coding agent do you want to install?");
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain("@anthropic-ai/claude-code");
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain("@openai/codex");
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain("https://router.flatkey.ai/v1");
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).toContain('model = ""gpt-5.5""');
    expect(CLAUDE_CODE_WINDOWS_INSTALL_SCRIPT).not.toContain('model = ""gpt-5""');
  });

  test("uses generic public installer names", () => {
    expect(CLAUDE_CODE_INSTALL_COMMANDS.macos).toBe("curl -fsSL https://flatkey.ai/install.sh | bash");
    expect(CLAUDE_CODE_INSTALL_COMMANDS.linux).toBe("curl -fsSL https://flatkey.ai/install.sh | bash");
    expect(CLAUDE_CODE_INSTALL_COMMANDS.windows).toBe("iwr https://flatkey.ai/install.ps1 -UseBasicParsing | iex");
    expect(Object.values(CLAUDE_CODE_INSTALL_COMMANDS).join("\n")).not.toContain("install-claude-code");
  });

  test("selects the matching install tab from platform text", () => {
    expect(detectClaudeCodeInstallTab("MacIntel")).toBe("macos");
    expect(detectClaudeCodeInstallTab("Linux x86_64")).toBe("linux");
    expect(detectClaudeCodeInstallTab("Win32")).toBe("windows");
    expect(detectClaudeCodeInstallTab("")).toBe("macos");
  });

  test("defines separate Codex and Claude Code landing pages", () => {
    expect(CODEX_USE_CASE.pathname).toBe("/use-case/codex");
    expect(CODEX_USE_CASE.toolName).toBe("Codex");
    expect(CODEX_USE_CASE.endpointText).toBe("https://router.flatkey.ai/v1");
    expect(CLAUDE_CODE_USE_CASE.pathname).toBe("/use-case/claude-code");
    expect(CLAUDE_CODE_USE_CASE.toolName).toBe("Claude Code");
    expect(CLAUDE_CODE_USE_CASE.endpointText).toBe("https://router.flatkey.ai");
    expect(IMAGE_BUDDY_USE_CASE.pathname).toBe("/use-case/image-buddy");
    expect(IMAGE_BUDDY_USE_CASE.toolName).toBe("Image Buddy");
    expect(IMAGE_BUDDY_USE_CASE.endpointText).toBe("npx @flatkey-ai/image-buddy");
  });

  test("provides localized configs for every website locale", () => {
    for (const locale of LOCALES) {
      const imageBuddyConfig = getUseCaseConfig(IMAGE_BUDDY_USE_CASE.pathname, locale);
      expect(getUseCaseConfig(CODEX_USE_CASE.pathname, locale).pathname).toBe("/use-case/codex");
      expect(getUseCaseConfig(CLAUDE_CODE_USE_CASE.pathname, locale).pathname).toBe("/use-case/claude-code");
      expect(imageBuddyConfig.pathname).toBe("/use-case/image-buddy");
      expect(getUseCaseConfig(CODEX_USE_CASE.pathname, locale).headlineLead.length).toBeGreaterThan(0);
      expect(getUseCaseConfig(CLAUDE_CODE_USE_CASE.pathname, locale).headlineLead.length).toBeGreaterThan(0);
      expect(imageBuddyConfig.endpointText).toBe("npx @flatkey-ai/image-buddy");
      if (locale !== "en") {
        expect(imageBuddyConfig.headlineLead).not.toBe(IMAGE_BUDDY_USE_CASE.headlineLead);
        expect(imageBuddyConfig.intro).not.toBe(IMAGE_BUDDY_USE_CASE.intro);
      }
    }
  });

  test("defines a focused Image Buddy CLI quickstart", () => {
    expect(IMAGE_BUDDY_QUICKSTART_STEPS).toEqual([
      {
        label: "Step 1",
        title: "Install",
        command: "npm i -g @flatkey-ai/image-buddy",
      },
      {
        label: "Step 2",
        title: "Initialize",
        command: "npx @flatkey-ai/image-buddy onboard",
      },
      {
        label: "Step 3",
        title: "Generate",
        command: 'npx @flatkey-ai/image-buddy generate --prompt "premium product hero image for an AI image API CLI"',
      },
    ]);
    expect(IMAGE_BUDDY_QUICKSTART_STEPS.map((step) => step.command).join("\n")).not.toContain("image-buddy web");
  });

  test("does not render an Image Buddy prompt block in the CLI quickstart", () => {
    const source = readFileSync(new URL("../components/coding-agent-use-case-page.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("imageBuddySkillPrompt");
    expect(source).not.toContain("Install and use the Flatkey Image Buddy skill");
  });
});
