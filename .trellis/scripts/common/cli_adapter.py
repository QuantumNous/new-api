"""
CLI Adapter for Multi-Platform Support.

Abstracts differences between Claude Code, OpenCode, Cursor, iFlow, Codex, Kilo, Kiro Code, Gemini CLI, Antigravity, Devin, Qoder, CodeBuddy, GitHub Copilot, Factory Droid, and Pi Agent interfaces.

Supported platforms:
- claude: Claude Code (default)
- opencode: OpenCode
- cursor: Cursor IDE
- iflow: iFlow CLI
- codex: Codex CLI (skills-based)
- kilo: Kilo CLI
- kiro: Kiro Code (skills-based)
- gemini: Gemini CLI
- antigravity: Antigravity (workflow-based)
- devin: Devin (formerly Windsurf; workflow-based)
- qoder: Qoder
- codebuddy: CodeBuddy
- copilot: GitHub Copilot (VS Code)
- droid: Factory Droid (commands-based)
- pi: Pi Agent (extension-backed)
- trae: Trae IDE (IDE-only, hooks-based)

Usage:
    from common.cli_adapter import CLIAdapter

    adapter = CLIAdapter("opencode")
    cmd = adapter.build_run_command(
        agent="dispatch",
        session_id="abc123",
        prompt="Start the pipeline"
    )
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar, Literal

Platform = Literal[
    "claude",
    "opencode",
    "cursor",
    "iflow",
    "codex",
    "kilo",
    "kiro",
    "gemini",
    "antigravity",
    "devin",
    "qoder",
    "codebuddy",
    "copilot",
    "droid",
    "pi",
    "trae",
]


@dataclass
class CLIAdapter:
    """Adapter for different AI coding CLI tools."""

    platform: Platform

    # =========================================================================
    # Agent Name Mapping
    # =========================================================================

    # OpenCode has built-in agents that cannot be overridden
    # See: https://github.com/sst/opencode/issues/4271
    # Note: Class-level constant, not a dataclass field
    _AGENT_NAME_MAP: ClassVar[dict[Platform, dict[str, str]]] = {
        "claude": {},  # No mapping needed
        "opencode": {
            "plan": "trellis-plan",  # 'plan' is built-in in OpenCode
        },
    }

    def get_agent_name(self, agent: str) -> str:
        """Get platform-specific agent name.

        Args:
            agent: Original agent name (e.g., 'plan', 'dispatch')

        Returns:
            Platform-specific agent name (e.g., 'trellis-plan' for OpenCode)
        """
        mapping = self._AGENT_NAME_MAP.get(self.platform, {})
        return mapping.get(agent, agent)

    # =========================================================================
    # Agent Path
    # =========================================================================

    @property
    def config_dir_name(self) -> str:
        """Get platform-specific config directory name.

        Returns:
            Directory name ('.claude', '.opencode', '.cursor', '.iflow', '.codex', '.kilocode', '.kiro', '.gemini', '.agent', '.devin', '.qoder', '.codebuddy', '.github/copilot', '.factory', '.pi', or '.trae')
        """
        if self.platform == "opencode":
            return ".opencode"
        elif self.platform == "cursor":
            return ".cursor"
        elif self.platform == "iflow":
            return ".iflow"
        elif self.platform == "codex":
            return ".codex"
        elif self.platform == "kilo":
            return ".kilocode"
        elif self.platform == "kiro":
            return ".kiro"
        elif self.platform == "gemini":
            return ".gemini"
        elif self.platform == "antigravity":
            return ".agent"
        elif self.platform == "devin":
            return ".devin"
        elif self.platform == "qoder":
            return ".qoder"
        elif self.platform == "codebuddy":
            return ".codebuddy"
        elif self.platform == "copilot":
            return ".github/copilot"
        elif self.platform == "droid":
            return ".factory"
        elif self.platform == "pi":
            return ".pi"
        elif self.platform == "trae":
            return ".trae"
        else:
            return ".claude"

    def get_config_dir(self, project_root: Path) -> Path:
        """Get platform-specific config directory.

        Args:
            project_root: Project root directory

        Returns:
            Path to config directory (.claude, .opencode, .cursor, .iflow, .codex, .kilocode, .kiro, .gemini, .agent, .devin, .qoder, .codebuddy, .github/copilot, .factory, .pi, or .trae)
        """
        return project_root / self.config_dir_name

    def get_agent_path(self, agent: str, project_root: Path) -> Path:
        """Get path to agent definition file.

        Args:
            agent: Agent name (original, before mapping)
            project_root: Project root directory

        Returns:
            Path to agent definition file (.md for most platforms, .toml for Codex)
        """
        mapped_name = self.get_agent_name(agent)
        if self.platform == "codex":
            return self.get_config_dir(project_root) / "agents" / f"{mapped_name}.toml"
        return self.get_config_dir(project_root) / "agents" / f"{mapped_name}.md"

    def get_commands_path(self, project_root: Path, *parts: str) -> Path:
        """Get path to commands directory or specific command file.

        Args:
            project_root: Project root directory
            *parts: Additional path parts (e.g., 'trellis', 'finish-work.md')

        Returns:
            Path to commands directory or file

        Note:
            Cursor uses prefix naming: .cursor/commands/trellis-<name>.md
            Antigravity uses workflow directory: .agent/workflows/<name>.md
            Devin uses workflow directory: .devin/workflows/trellis-<name>.md
            Copilot uses prompt files: .github/prompts/<name>.prompt.md
            Pi uses prompt templates: .pi/prompts/trellis-<name>.md
            Claude/OpenCode use subdirectory: .claude/commands/trellis/<name>.md
        """
        if self.platform == "pi":
            prompts_dir = self.get_config_dir(project_root) / "prompts"
            if not parts:
                return prompts_dir
            if len(parts) >= 2 and parts[0] == "trellis":
                filename = parts[-1]
                if filename.endswith(".md"):
                    filename = filename[:-3]
                return prompts_dir / f"trellis-{filename}.md"
            return prompts_dir / Path(*parts)

        if self.platform == "devin":
            workflow_dir = self.get_config_dir(project_root) / "workflows"
            if not parts:
                return workflow_dir
            if len(parts) >= 2 and parts[0] == "trellis":
                filename = parts[-1]
                return workflow_dir / f"trellis-{filename}"
            return workflow_dir / Path(*parts)

        if self.platform in ("antigravity", "kilo"):
            workflow_dir = self.get_config_dir(project_root) / "workflows"
            if not parts:
                return workflow_dir
            if len(parts) >= 2 and parts[0] == "trellis":
                filename = parts[-1]
                return workflow_dir / filename
            return workflow_dir / Path(*parts)

        if self.platform == "copilot":
            prompts_dir = project_root / ".github" / "prompts"
            if not parts:
                return prompts_dir
            if len(parts) >= 2 and parts[0] == "trellis":
                filename = parts[-1]
                if filename.endswith(".md"):
                    filename = filename[:-3]
                return prompts_dir / f"{filename}.prompt.md"
            return prompts_dir / Path(*parts)

        if not parts:
            return self.get_config_dir(project_root) / "commands"

        # Cursor uses prefix naming instead of subdirectory
        if self.platform == "cursor" and len(parts) >= 2 and parts[0] == "trellis":
            # Convert trellis/<name>.md to trellis-<name>.md
            filename = parts[-1]
            return (
                self.get_config_dir(project_root) / "commands" / f"trellis-{filename}"
            )

        return self.get_config_dir(project_root) / "commands" / Path(*parts)

    def get_trellis_command_path(self, name: str) -> str:
        """Get relative path to a trellis command file.

        Args:
            name: Command name without extension (e.g., 'finish-work', 'check')

        Returns:
            Relative path string for use in JSONL entries

        Note:
            Cursor: .cursor/commands/trellis-<name>.md
            Codex: .agents/skills/trellis-<name>/SKILL.md
            Kiro: .kiro/skills/trellis-<name>/SKILL.md
            Gemini: .gemini/commands/trellis/<name>.toml
            Antigravity: .agent/workflows/<name>.md
            Devin: .devin/workflows/trellis-<name>.md
            Pi: .pi/prompts/trellis-<name>.md
            Others: .{platform}/commands/trellis/<name>.md
        """
        if self.platform == "cursor":
            return f".cursor/commands/trellis-{name}.md"
        elif self.platform == "codex":
            # 0.5.0-beta.0 renamed all skill dirs to add the `trellis-` prefix
            # (see that release's manifest for the 60+ rename entries).
            return f".agents/skills/trellis-{name}/SKILL.md"
        elif self.platform == "kiro":
            return f".kiro/skills/trellis-{name}/SKILL.md"
        elif self.platform == "gemini":
            return f".gemini/commands/trellis/{name}.toml"
        elif self.platform == "antigravity":
            return f".agent/workflows/{name}.md"
        elif self.platform == "devin":
            return f".devin/workflows/trellis-{name}.md"
        elif self.platform == "kilo":
            return f".kilocode/workflows/{name}.md"
        elif self.platform == "copilot":
            return f".github/prompts/{name}.prompt.md"
        elif self.platform == "droid":
            return f".factory/commands/trellis/{name}.md"
        elif self.platform == "pi":
            return f".pi/prompts/trellis-{name}.md"
        else:
            return f"{self.config_dir_name}/commands/trellis/{name}.md"

    # =========================================================================
    # Environment Variables
    # =========================================================================

    def get_non_interactive_env(self) -> dict[str, str]:
        """Get environment variables for non-interactive mode.

        Returns:
            Dict of environment variables to set
        """
        if self.platform == "opencode":
            return {"OPENCODE_NON_INTERACTIVE": "1"}
        elif self.platform == "iflow":
            return {"IFLOW_NON_INTERACTIVE": "1"}
        elif self.platform == "codex":
            return {"CODEX_NON_INTERACTIVE": "1"}
        elif self.platform == "kiro":
            return {"KIRO_NON_INTERACTIVE": "1"}
        elif self.platform == "gemini":
            return {}  # Gemini CLI doesn't have a non-interactive env var
        elif self.platform == "antigravity":
            return {}
        elif self.platform == "devin":
            return {}
        elif self.platform == "qoder":
            return {}
        elif self.platform == "codebuddy":
            return {}
        elif self.platform == "copilot":
            return {}
        elif self.platform == "droid":
            return {}
        elif self.platform == "pi":
            return {}
        elif self.platform == "trae":
            return {}
        else:
            return {"CLAUDE_NON_INTERACTIVE": "1"}

    # =========================================================================
    # CLI Command Building
    # =========================================================================

    def build_run_command(
        self,
        agent: str,
        prompt: str,
        session_id: str | None = None,
        skip_permissions: bool = True,
        verbose: bool = True,
        json_output: bool = True,
    ) -> list[str]:
        """Build CLI command for running an agent.

        Args:
            agent: Agent name (will be mapped if needed)
            prompt: Prompt to send to the agent
            session_id: Optional session ID (Claude Code only for creation)
            skip_permissions: Whether to skip permission prompts
            verbose: Whether to enable verbose output
            json_output: Whether to use JSON output format

        Returns:
            List of command arguments
        """
        mapped_agent = self.get_agent_name(agent)

        if self.platform == "opencode":
            cmd = ["opencode", "run"]
            cmd.extend(["--agent", mapped_agent])

            # Note: OpenCode 'run' mode is non-interactive by default
            # No equivalent to Claude Code's --dangerously-skip-permissions
            # See: https://github.com/anomalyco/opencode/issues/9070

            if json_output:
                cmd.extend(["--format", "json"])

            if verbose:
                cmd.extend(["--log-level", "DEBUG", "--print-logs"])

            # Note: OpenCode doesn't support --session-id on creation
            # Session ID must be extracted from logs after startup

            cmd.append(prompt)

        elif self.platform == "iflow":
            cmd = ["iflow", "-y", "-p"]
            cmd.append(f"${mapped_agent} {prompt}")
        elif self.platform == "codex":
            cmd = ["codex", "exec"]
            cmd.append(prompt)
        elif self.platform == "kiro":
            cmd = ["kiro", "run", prompt]
        elif self.platform == "gemini":
            cmd = ["gemini"]
            cmd.append(prompt)
        elif self.platform == "antigravity":
            raise ValueError(
                "Antigravity workflows are UI slash commands; CLI agent run is not supported."
            )
        elif self.platform == "devin":
            raise ValueError(
                "Devin workflows are UI slash commands; CLI agent run is not supported."
            )
        elif self.platform == "qoder":
            cmd = ["qodercli", "-p", prompt]
        elif self.platform == "codebuddy":
            raise ValueError(
                "CodeBuddy does not support non-interactive mode (no CLI agent)"
            )
        elif self.platform == "copilot":
            raise ValueError(
                "GitHub Copilot is IDE-only; CLI agent run is not supported."
            )
        elif self.platform == "droid":
            raise ValueError(
                "Factory Droid CLI agent run is not yet supported."
            )
        elif self.platform == "pi":
            cmd = ["pi", "-p", prompt]
        elif self.platform == "trae":
            raise ValueError(
                "Trae is IDE-only; CLI agent run is not supported."
            )

        else:  # claude
            cmd = ["claude", "-p"]
            cmd.extend(["--agent", mapped_agent])

            if session_id:
                cmd.extend(["--session-id", session_id])

            if skip_permissions:
                cmd.append("--dangerously-skip-permissions")

            if json_output:
                cmd.extend(["--output-format", "stream-json"])

            if verbose:
                cmd.append("--verbose")

            cmd.append(prompt)

        return cmd

    def build_resume_command(self, session_id: str) -> list[str]:
        """Build CLI command for resuming a session.

        Args:
            session_id: Session ID to resume (ignored for iFlow)

        Returns:
            List of command arguments
        """
        if self.platform == "opencode":
            return ["opencode", "run", "--session", session_id]
        elif self.platform == "iflow":
            # iFlow uses -c to continue most recent conversation
            # session_id is ignored as iFlow doesn't support session IDs
            return ["iflow", "-c"]
        elif self.platform == "codex":
            return ["codex", "resume", session_id]
        elif self.platform == "kiro":
            return ["kiro", "resume", session_id]
        elif self.platform == "gemini":
            return ["gemini", "--resume", session_id]
        elif self.platform == "antigravity":
            raise ValueError(
                "Antigravity workflows are UI slash commands; CLI resume is not supported."
            )
        elif self.platform == "devin":
            raise ValueError(
                "Devin workflows are UI slash commands; CLI resume is not supported."
            )
        elif self.platform == "qoder":
            return ["qodercli", "--resume", session_id]
        elif self.platform == "codebuddy":
            raise ValueError(
                "CodeBuddy does not support non-interactive mode (no CLI agent)"
            )
        elif self.platform == "copilot":
            raise ValueError(
                "GitHub Copilot is IDE-only; CLI resume is not supported."
            )
        elif self.platform == "droid":
            raise ValueError(
                "Factory Droid CLI resume is not yet supported."
            )
        elif self.platform == "pi":
            return ["pi", "-c", session_id]
        elif self.platform == "trae":
            raise ValueError(
                "Trae is IDE-only; CLI resume is not supported."
            )
        else:
            return ["claude", "--resume", session_id]

    def get_resume_command_str(self, session_id: str, cwd: str | None = None) -> str:
        """Get human-readable resume command string.

        Args:
            session_id: Session ID to resume
            cwd: Optional working directory to cd into

        Returns:
            Command string for display
        """
        cmd = self.build_resume_command(session_id)
        cmd_str = " ".join(cmd)

        if cwd:
            return f"cd {cwd} && {cmd_str}"
        return cmd_str

    # =========================================================================
    # Platform Detection Helpers
    # =========================================================================

    @property
    def is_opencode(self) -> bool:
        """Check if platform is OpenCode."""
        return self.platform == "opencode"

    @property
    def is_claude(self) -> bool:
        """Check if platform is Claude Code."""
        return self.platform == "claude"

    @property
    def is_cursor(self) -> bool:
        """Check if platform is Cursor."""
        return self.platform == "cursor"

    @property
    def is_iflow(self) -> bool:
        """Check if platform is iFlow CLI."""
        return self.platform == "iflow"

    @property
    def cli_name(self) -> str:
        """Get CLI executable name.

        Note: Cursor doesn't have a CLI tool, returns None-like value.
        """
        if self.is_opencode:
            return "opencode"
        elif self.is_cursor:
            return "cursor"  # Note: Cursor is IDE-only, no CLI
        elif self.platform == "iflow":
            return "iflow"
        elif self.platform == "kiro":
            return "kiro"
        elif self.platform == "gemini":
            return "gemini"
        elif self.platform == "antigravity":
            return "agy"
        elif self.platform == "devin":
            return "devin"
        elif self.platform == "qoder":
            return "qodercli"
        elif self.platform == "codebuddy":
            return "codebuddy"
        elif self.platform == "copilot":
            return "copilot"
        elif self.platform == "droid":
            return "droid"
        elif self.platform == "pi":
            return "pi"
        elif self.platform == "trae":
            return "trae"
        else:
            return "claude"

    @property
    def supports_cli_agents(self) -> bool:
        """Check if platform supports running agents via CLI.

        Claude Code, OpenCode, iFlow, and Codex support CLI agent execution.
        Cursor is IDE-only and doesn't support CLI agents.
        """
        return self.platform in ("claude", "opencode", "iflow", "codex", "pi")

    @property
    def requires_agent_definition_file(self) -> bool:
        """Check if platform requires an agent definition file (.md/.toml) to run.

        Claude Code, OpenCode, iFlow: require agent .md files (--agent flag).
        Codex: auto-discovers agents from .codex/agents/*.toml, no --agent flag.
        """
        return self.platform in ("claude", "opencode", "iflow")

    # =========================================================================
    # Session ID Handling
    # =========================================================================

    @property
    def supports_session_id_on_create(self) -> bool:
        """Check if platform supports specifying session ID on creation.

        Claude Code: Yes (--session-id)
        OpenCode: No (auto-generated, extract from logs)
        iFlow: No (no session ID support)
        """
        return self.platform == "claude"

    def extract_session_id_from_log(self, log_content: str) -> str | None:
        """Extract session ID from log output (OpenCode only).

        OpenCode generates session IDs in format: ses_xxx

        Args:
            log_content: Log file content

        Returns:
            Session ID if found, None otherwise
        """
        import re

        # OpenCode session ID pattern
        match = re.search(r"ses_[a-zA-Z0-9]+", log_content)
        if match:
            return match.group(0)
        return None


# =============================================================================
# Factory Function
# =============================================================================


def get_cli_adapter(platform: str = "claude") -> CLIAdapter:
    """Get CLI adapter for the specified platform.

    Args:
        platform: Platform name ('claude', 'opencode', 'cursor', 'iflow', 'codex', 'kilo', 'kiro', 'gemini', 'antigravity', 'devin', 'qoder', 'codebuddy', 'copilot', 'droid', 'pi', or 'trae')

    Returns:
        CLIAdapter instance

    Raises:
        ValueError: If platform is not supported

    Note:
        'windsurf' is accepted as a deprecated alias for 'devin' (Windsurf was
        renamed to Devin) and normalized before validation.
    """
    # Deprecated alias: Windsurf was renamed to Devin.
    if platform == "windsurf":
        platform = "devin"
    if platform not in (
        "claude",
        "opencode",
        "cursor",
        "iflow",
        "codex",
        "kilo",
        "kiro",
        "gemini",
        "antigravity",
        "devin",
        "qoder",
        "codebuddy",
        "copilot",
        "droid",
        "pi",
        "trae",
    ):
        raise ValueError(
            f"Unsupported platform: {platform} (must be 'claude', 'opencode', 'cursor', 'iflow', 'codex', 'kilo', 'kiro', 'gemini', 'antigravity', 'devin', 'qoder', 'codebuddy', 'copilot', 'droid', 'pi', or 'trae')"
        )

    return CLIAdapter(platform=platform)  # type: ignore


_ALL_PLATFORM_CONFIG_DIRS = (
    ".claude",
    ".cursor",
    ".iflow",
    ".opencode",
    ".codex",
    ".kilocode",
    ".kiro",
    ".gemini",
    ".agent",
    ".devin",
    ".windsurf",  # deprecated: pre-rename Devin config dir (still a platform signal)
    ".qoder",
    ".codebuddy",
    ".github/copilot",
    ".factory",
    ".pi",
    ".trae",
)
"""Platform-specific config directory names used by detect_platform exclusion
checks. `.agents/skills/` is NOT listed here: it is a shared cross-platform
layer (written by Codex, also consumed by Amp/Cline/Warp/etc. via the
agentskills.io standard), not a single-platform signal. Its presence must not
block detection of Kiro, Antigravity, Devin, or other platforms."""


def _has_other_platform_dir(project_root: Path, exclude: set[str]) -> bool:
    """Check if any platform config dir exists besides those in *exclude*."""
    return any(
        (project_root / d).is_dir()
        for d in _ALL_PLATFORM_CONFIG_DIRS
        if d not in exclude
    )


def detect_platform(project_root: Path) -> Platform:
    """Auto-detect platform based on existing config directories.

    Detection order:
    1. TRELLIS_PLATFORM environment variable (if set)
    2. .opencode directory exists → opencode
    3. .iflow directory exists → iflow
    4. .cursor directory exists (without .claude) → cursor
    5. .gemini directory exists → gemini
    6. .codex exists and no other platform dirs → codex
    7. .kilocode directory exists → kilo
    8. .kiro/skills exists and no other platform dirs → kiro
    9. .agent/workflows exists and no other platform dirs → antigravity
    10. .devin/workflows (or legacy .windsurf/workflows) exists and no other platform dirs → devin
    11. .codebuddy directory exists → codebuddy
    12. .qoder directory exists → qoder
    13. .github/copilot directory exists → copilot
    14. .factory directory exists → droid
    15. .pi directory exists → pi
    16. .trae directory exists → trae
    17. Default → claude

    Args:
        project_root: Project root directory

    Returns:
        Detected platform ('claude', 'opencode', 'cursor', 'iflow', 'codex', 'kilo', 'kiro', 'gemini', 'antigravity', 'devin', 'qoder', 'codebuddy', 'copilot', 'droid', 'pi', 'trae', or default 'claude')
    """
    import os

    # Check environment variable first
    env_platform = os.environ.get("TRELLIS_PLATFORM", "").lower()
    # Deprecated alias: Windsurf was renamed to Devin.
    if env_platform == "windsurf":
        env_platform = "devin"
    if env_platform in (
        "claude",
        "opencode",
        "cursor",
        "iflow",
        "codex",
        "kilo",
        "kiro",
        "gemini",
        "antigravity",
        "devin",
        "qoder",
        "codebuddy",
        "copilot",
        "droid",
        "pi",
        "trae",
    ):
        return env_platform  # type: ignore

    # Check for .opencode directory (OpenCode-specific)
    if (project_root / ".opencode").is_dir():
        return "opencode"

    # Check for .iflow directory (iFlow-specific)
    if (project_root / ".iflow").is_dir():
        return "iflow"

    # Check for .cursor directory (Cursor-specific)
    # Only detect as cursor if .claude doesn't exist (to avoid confusion)
    if (project_root / ".cursor").is_dir() and not (project_root / ".claude").is_dir():
        return "cursor"

    # Check for .gemini directory (Gemini CLI-specific)
    if (project_root / ".gemini").is_dir():
        return "gemini"

    # Check for .codex directory (Codex-specific)
    # .agents/skills/ alone does NOT trigger codex detection (it's a shared standard)
    if (project_root / ".codex").is_dir() and not _has_other_platform_dir(
        project_root, {".codex", ".agents"}
    ):
        return "codex"

    # Check for .kilocode directory (Kilo-specific)
    if (project_root / ".kilocode").is_dir():
        return "kilo"

    # Check for Kiro skills directory only when no other platform config exists
    if (project_root / ".kiro" / "skills").is_dir() and not _has_other_platform_dir(
        project_root, {".kiro"}
    ):
        return "kiro"

    # Check for Antigravity workflow directory only when no other platform config exists
    if (
        project_root / ".agent" / "workflows"
    ).is_dir() and not _has_other_platform_dir(
        project_root, {".agent", ".gemini"}
    ):
        return "antigravity"

    # Check for Devin workflow directory only when no other platform config
    # exists. `.windsurf/workflows` is the legacy pre-rename path (still detected
    # as devin for back-compat until users migrate via `trellis update --migrate`).
    if (
        (project_root / ".devin" / "workflows").is_dir()
        or (project_root / ".windsurf" / "workflows").is_dir()
    ) and not _has_other_platform_dir(
        project_root, {".devin", ".windsurf"}
    ):
        return "devin"

    # Check for .codebuddy directory (CodeBuddy-specific)
    if (project_root / ".codebuddy").is_dir():
        return "codebuddy"

    # Check for .qoder directory (Qoder-specific)
    if (project_root / ".qoder").is_dir():
        return "qoder"

    # Check for .github/copilot directory (GitHub Copilot-specific)
    if (project_root / ".github" / "copilot").is_dir():
        return "copilot"

    # Check for .factory directory (Factory Droid-specific)
    if (project_root / ".factory").is_dir():
        return "droid"

    # Check for .pi directory (Pi Agent-specific)
    if (project_root / ".pi").is_dir():
        return "pi"

    # Check for .trae directory (Trae IDE-specific)
    if (project_root / ".trae").is_dir():
        return "trae"

    # Fallback: checkout only has the Codex shared-skills layer
    # (.agents/skills/trellis-* dirs) and no explicit platform config dir.
    # Happens on fresh clones where .codex/ is gitignored/absent but the
    # shared skills were committed to git. Must guard against the case
    # where .claude/ or any other platform dir also exists — .agents/skills/
    # can legitimately coexist with any platform as a shared consumption
    # layer for Amp/Cline/Warp/etc.
    agents_skills = project_root / ".agents" / "skills"
    if agents_skills.is_dir() and not _has_other_platform_dir(
        project_root, set()
    ):
        try:
            for entry in agents_skills.iterdir():
                if entry.is_dir() and entry.name.startswith("trellis-"):
                    return "codex"
        except OSError:
            pass

    return "claude"


def get_cli_adapter_auto(project_root: Path) -> CLIAdapter:
    """Get CLI adapter with auto-detected platform.

    Args:
        project_root: Project root directory

    Returns:
        CLIAdapter instance for detected platform
    """
    platform = detect_platform(project_root)
    return CLIAdapter(platform=platform)
