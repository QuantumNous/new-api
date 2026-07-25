"""Textual TUI — the first surface. Renders the engine's event stream, routes approvals
to a modal, and supports a few slash commands. Talks to the engine in-process for now
(the OpenAI-compatible server is a later phase)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, Footer, Header, Input, Label, RichLog, Static

from ..agent import build_code_engine
from ..engine import ApprovalOutcome, PermissionRequest
from ..events import Event, EventType
from ..conversations import ConversationStore
from ..memory import MemoryStore
from ..permissions import Mode
from ..providers import ProviderClient
from ..sessions import SessionRecord


def _short(value: Any, limit: int = 80) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    text = text.replace("\n", "\\n")
    return text if len(text) <= limit else text[: limit - 1] + "…"


class ApprovalScreen(ModalScreen[ApprovalOutcome]):
    BINDINGS = [
        Binding("y", "decide('once')", "Approve"),
        Binding("n", "decide('deny')", "Deny"),
        Binding("a", "decide('always_tool')", "Always tool"),
        Binding("c", "decide('always_command')", "Always cmd"),
    ]

    def __init__(self, request: PermissionRequest) -> None:
        super().__init__()
        self.request = request

    def compose(self) -> ComposeResult:
        r = self.request
        args = ", ".join(f"{k}={_short(v)}" for k, v in (r.arguments or {}).items())
        with Vertical(id="approval"):
            yield Label("Permission required", id="approval-title")
            yield Static(f"tool:   {r.tool_name}")
            yield Static(f"args:   {args or '(none)'}")
            yield Static(f"reason: {r.reason}")
            with Horizontal(id="approval-buttons"):
                yield Button("Approve (y)", id="once", variant="success")
                yield Button("Deny (n)", id="deny", variant="error")
                yield Button("Always tool (a)", id="always_tool")
                yield Button("Always cmd (c)", id="always_command")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.dismiss(ApprovalOutcome(event.button.id))

    def action_decide(self, outcome: str) -> None:
        self.dismiss(ApprovalOutcome(outcome))


class CoworkerApp(App):
    CSS = """
    #log { border: round $primary 30%; padding: 0 1; }
    #prompt { dock: bottom; }
    #approval { padding: 1 2; border: thick $warning; background: $panel; width: 80%; }
    #approval-title { text-style: bold; color: $warning; }
    #approval-buttons { height: auto; padding-top: 1; }
    #approval-buttons Button { margin-right: 1; }
    """
    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit"),
        Binding("escape", "interrupt", "Interrupt"),
    ]

    def __init__(
        self,
        *,
        workspace: str | Path,
        model: str = "gpt-5.6-sol",
        mode: Mode = Mode.INTERACTIVE,
        provider: Optional[ProviderClient] = None,
        memory_store: Optional[MemoryStore] = None,
        session_store: Optional[ConversationStore] = None,
        session_id: Optional[str] = None,
        resume_messages: Optional[list[dict]] = None,
    ) -> None:
        super().__init__()
        self.workspace = Path(workspace).expanduser().resolve()
        self.model = model
        self.mode = mode
        self._provider = provider
        self._memory_store = memory_store
        self._session_store = session_store
        self._session_id = session_id
        self._resume_messages = resume_messages
        self.engine = None
        self.rendered: list[str] = []  # plain-text mirror for tests

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)
        yield RichLog(id="log", wrap=True, markup=True, highlight=False)
        yield Input(placeholder="Ask the coder…   (/help for commands)", id="prompt")
        yield Footer()

    def on_mount(self) -> None:
        self.engine = build_code_engine(
            workspace=self.workspace,
            model=self.model,
            mode=self.mode,
            approver=self._approve,
            provider=self._provider,
            memory_store=self._memory_store,
            messages=self._resume_messages,
        )
        self._write(
            f"[b]coworker · code[/b]  ·  model {self.model}  ·  mode {self.mode.value}"
        )
        self._write(f"workspace: {self.workspace}")
        if self._resume_messages:
            self._write(
                f"[dim]resumed session {self._session_id} · "
                f"{len(self._resume_messages)} messages[/dim]"
            )
        self._write("Type a request, or /help for commands.\n")
        self.query_one("#prompt", Input).focus()

    # -- approvals --------------------------------------------------------------
    async def _approve(self, request: PermissionRequest) -> ApprovalOutcome:
        return await self.push_screen_wait(ApprovalScreen(request))

    # -- input ------------------------------------------------------------------
    async def on_input_submitted(self, event: Input.Submitted) -> None:
        text = event.value.strip()
        self.query_one("#prompt", Input).value = ""
        if not text:
            return
        if text.startswith("/"):
            self._handle_command(text)
            return
        self._write(f"[b cyan]you[/b cyan] › {text}")
        self.run_turn(text)

    @work(exclusive=True)
    async def run_turn(self, text: str) -> None:
        assert self.engine is not None
        try:
            async for event in self.engine.run(text):
                self._render_event(event)
        except Exception as exc:  # pragma: no cover - surfaced to the user
            self._write(f"[red]error:[/red] {exc}")
        self._persist_session()

    def _persist_session(self) -> None:
        if self._session_store is None or self.engine is None or not self._session_id:
            return
        self._session_store.save(
            SessionRecord(
                session_id=self._session_id,
                workspace=str(self.workspace),
                model=self.model,
                mode=self.mode.value,
                messages=self.engine.messages,
            )
        )

    # -- rendering --------------------------------------------------------------
    def _render_event(self, event: Event) -> None:
        data = event.data
        if event.type is EventType.ASSISTANT_MESSAGE:
            if data.get("text"):
                self._write(f"[b green]assistant[/b green]\n{data['text']}")
        elif event.type is EventType.TOOL_PROPOSED:
            self._write(
                f"[yellow]→ {data['name']}[/yellow] {_short(data.get('arguments'), 100)}"
            )
        elif event.type is EventType.TOOL_FINISHED:
            status = data.get("status")
            tag = "green" if status == "ok" else "red"
            extra = data.get("result_preview") or data.get("reason") or ""
            self._write(
                f"  [{tag}]✓ {data['name']} · {status}[/{tag}] {_short(extra, 100)}"
            )
        elif event.type is EventType.INTERRUPTED:
            self._write("[red]⏹ interrupted[/red]")
        elif event.type is EventType.ERROR:
            self._write(f"[red]error: {data.get('error')}[/red]")
        elif event.type is EventType.TURN_END:
            if data.get("status") == "max_iterations_exceeded":
                self._write("[red]⚠ stopped: max iterations reached[/red]")

    def _write(self, text: str) -> None:
        self.rendered.append(text)
        if self.is_running:
            self.query_one("#log", RichLog).write(text)

    # -- commands ---------------------------------------------------------------
    def _handle_command(self, command: str) -> None:
        parts = command.split()
        name = parts[0]
        arg = parts[1] if len(parts) > 1 else None
        if name in {"/quit", "/exit"}:
            self.exit()
        elif name == "/help":
            self._write(
                "commands: /mode plan|interactive|auto · /model <id> · /clear · /quit"
            )
        elif name == "/mode" and arg in {"plan", "interactive", "auto"}:
            self.mode = Mode(arg)
            if self.engine:
                self.engine.permissions.mode = self.mode
            self._write(f"mode → {arg}")
        elif name == "/model" and arg:
            self.model = arg
            if self.engine:
                self.engine.model = arg
            self._write(f"model → {arg}")
        elif name == "/clear":
            if self.engine:
                self.engine.messages = []
                self.engine = build_code_engine(
                    workspace=self.workspace,
                    model=self.model,
                    mode=self.mode,
                    approver=self._approve,
                    provider=self._provider,
                )
            self.query_one("#log", RichLog).clear()
            self.rendered.clear()
            self._write("conversation cleared")
        else:
            self._write(f"[red]unknown command:[/red] {command}")

    def action_interrupt(self) -> None:
        if self.engine:
            self.engine.request_interrupt()

    def action_quit(self) -> None:  # type: ignore[override]
        engine = self.engine
        executor = getattr(engine, "executor", None) if engine else None
        if executor:
            executor.close()
        self.exit()
