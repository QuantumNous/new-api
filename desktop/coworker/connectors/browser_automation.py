"""Playwright-backed browser automation tools for Cowork.

The dependency is optional. If Playwright or its browser binaries are not installed, the
tools return a clear setup error instead of breaking engine construction.
"""

from __future__ import annotations

import re
import tempfile
import threading
import time
import base64
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Optional

import aisuite as ai


def _meta(
    name: str, *, approval: bool = False, capabilities: Optional[list[str]] = None
):
    return ai.ToolMetadata(
        name=name,
        category="connector",
        risk_level="medium" if approval else "low",
        capabilities=capabilities or ["browser"],
        requires_approval=approval,
    )


def _schema(
    name: str, description: str, properties: dict[str, Any], required: list[str]
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


def _attach(fn: Callable[..., Any], schema: dict[str, Any], *, approval: bool = True):
    from .tool_defs import approval_for_tool

    name = schema["function"]["name"]
    # §36: the tool registry's read/write kind wins for registered tools — reads never gate.
    approval = approval_for_tool(name, default=approval)
    fn.__coworker_schema__ = schema
    fn.__aisuite_tool_metadata__ = _meta(name, approval=approval)
    fn.__doc__ = schema["function"]["description"]
    return fn


class _BrowserController:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._error: Optional[str] = None
        self._executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="coworker-browser"
        )
        self._state: dict[str, Any] = {
            "open": False,
            "url": "",
            "title": "",
            "status": "closed",
            "last_action": "",
            "last_result": "",
            "last_error": "",
            "screenshot_data_url": "",
            "updated_at": None,
            "controls": [],
        }

    def _touch(self, **changes: Any) -> None:
        self._state.update(changes)
        self._state["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def _refresh_page_state(self) -> None:
        if self._page is None:
            self._touch(open=False, status="closed", url="", title="", controls=[])
            return
        try:
            snap = _snapshot(self._page, 2000)
            self._touch(
                open=True,
                status="open",
                url=self._page.url,
                title=self._page.title(),
                controls=snap.get("controls", [])[:30],
            )
        except Exception as exc:
            self._touch(open=True, status="error", last_error=str(exc))

    def _setup_error(self, exc: Exception) -> dict[str, str]:
        return {
            "error": (
                "Interactive browser automation requires Playwright. Install it with "
                "`pip install playwright` and `python -m playwright install chromium`."
            ),
            "details": str(exc),
        }

    def page(self):
        with self._lock:
            if self._error:
                return None, {"error": self._error}
            if self._page is not None:
                return self._page, None
            try:
                from playwright.sync_api import sync_playwright

                self._playwright = sync_playwright().start()
                self._browser = self._playwright.chromium.launch(headless=False)
                self._context = self._browser.new_context(
                    viewport={"width": 1280, "height": 900}
                )
                self._page = self._context.new_page()
                self._touch(
                    open=True, status="open", last_action="open browser", last_error=""
                )
                return self._page, None
            except Exception as exc:
                self._touch(open=False, status="error", last_error=str(exc))
                return None, self._setup_error(exc)

    def _submit(self, fn: Callable[[], dict[str, Any]]) -> dict[str, Any]:
        return self._executor.submit(fn).result()

    def close(self) -> dict[str, Any]:
        return self._submit(self._close_locked)

    def _close_locked(self) -> dict[str, Any]:
        with self._lock:
            try:
                if self._context is not None:
                    self._context.close()
                if self._browser is not None:
                    self._browser.close()
                if self._playwright is not None:
                    self._playwright.stop()
            except Exception as exc:
                return {"error": str(exc)}
            finally:
                self._playwright = None
                self._browser = None
                self._context = None
                self._page = None
                self._touch(open=False, status="closed", url="", title="", controls=[])
            return {"ok": True}

    def state(self) -> dict[str, Any]:
        return self._submit(self._state_locked)

    def _state_locked(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_page_state()
            return dict(self._state)

    def screenshot(self) -> dict[str, Any]:
        return self._submit(self._screenshot_locked)

    def _screenshot_locked(self) -> dict[str, Any]:
        with self._lock:
            page, err = self.page()
            if err:
                return err
            try:
                png = page.screenshot(full_page=False)
                data_url = "data:image/png;base64," + base64.b64encode(png).decode(
                    "ascii"
                )
                self._touch(
                    screenshot_data_url=data_url,
                    last_action="screenshot",
                    last_result="ok",
                    last_error="",
                )
                self._refresh_page_state()
                return {"ok": True, **dict(self._state)}
            except Exception as exc:
                self._touch(
                    last_action="screenshot", last_result="error", last_error=str(exc)
                )
                return {"error": str(exc)}

    def call(self, action: str, fn: Callable[[Any], dict[str, Any]]) -> dict[str, Any]:
        def run() -> dict[str, Any]:
            with self._lock:
                page, err = self.page()
                if err:
                    return err
                self._touch(last_action=action, last_result="running", last_error="")
                try:
                    out = fn(page)
                except Exception as exc:
                    out = {"error": str(exc)}
                if "error" in out:
                    self._touch(
                        last_action=action,
                        last_result="error",
                        last_error=str(out["error"]),
                    )
                else:
                    self._refresh_page_state()
                    self._touch(last_action=action, last_result="ok", last_error="")
                return out

        return self._submit(run)


_BROWSER = _BrowserController()


def browser_state() -> dict[str, Any]:
    return _BROWSER.state()


def browser_take_screenshot() -> dict[str, Any]:
    return _BROWSER.screenshot()


def browser_close_session() -> dict[str, Any]:
    return _BROWSER.close()


def _cap(value: int, default: int = 20000, upper: int = 100000) -> int:
    try:
        return max(1, min(int(value or default), upper))
    except Exception:
        return default


def _target_locator(page, target: str):
    target = target.strip()
    if target.startswith("text="):
        return page.get_by_text(target[5:], exact=False).first
    if target.startswith("role="):
        role_name = target[5:]
        role, _, name = role_name.partition(":")
        return page.get_by_role(role.strip(), name=name.strip() or None).first
    try:
        return page.locator(target).first
    except Exception:
        return page.get_by_text(target, exact=False).first


def _safe_call(fn: Callable[[], Any]) -> dict[str, Any]:
    try:
        return fn()
    except Exception as exc:
        return {"error": str(exc)}


def _browser_call(action: str, fn: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    return _BROWSER.call(action, lambda _page: fn())


_SNAPSHOT_JS = """
() => {
  const visible = (el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const labelFor = (el) => {
    if (el.labels && el.labels.length) return Array.from(el.labels).map(l => l.innerText.trim()).filter(Boolean).join(' ');
    const id = el.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) return label.innerText.trim();
    }
    return '';
  };
  const describe = (el, i) => ({
    index: i,
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    id: el.getAttribute('id') || '',
    name: el.getAttribute('name') || '',
    role: el.getAttribute('role') || '',
    aria: el.getAttribute('aria-label') || '',
    label: labelFor(el),
    placeholder: el.getAttribute('placeholder') || '',
    text: (el.innerText || el.value || '').trim().slice(0, 200),
    href: el.getAttribute('href') || '',
    selectorHint: el.getAttribute('id') ? `#${CSS.escape(el.getAttribute('id'))}` : (el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '')
  });
  const controls = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role="button"],[contenteditable="true"]'))
    .filter(visible)
    .slice(0, 120)
    .map(describe);
  return {
    title: document.title,
    url: location.href,
    text: document.body ? document.body.innerText : '',
    controls
  };
}
"""


def _snapshot(page, max_chars: int) -> dict[str, Any]:
    data = page.evaluate(_SNAPSHOT_JS)
    text = re.sub(r"\n{3,}", "\n\n", str(data.get("text") or ""))
    cap = _cap(max_chars)
    return {
        "title": data.get("title"),
        "url": data.get("url"),
        "text": text[:cap],
        "truncated": len(text) > cap,
        "controls": data.get("controls") or [],
    }


def make_browser_automation_tools() -> list[Callable[..., Any]]:
    tools: list[Callable[..., Any]] = []

    def browser_open_url(
        url: str, wait_until: str = "domcontentloaded"
    ) -> dict[str, Any]:
        if not url.lower().startswith(("http://", "https://")):
            return {"error": "url must start with http:// or https://"}
        return _BROWSER.call(
            "open_url",
            lambda page: (
                page.goto(url, wait_until=wait_until, timeout=30000),
                {"ok": True, "url": page.url},
            )[1],
        )

    browser_open_url.__name__ = "browser_open_url"
    tools.append(
        _attach(
            browser_open_url,
            _schema(
                "browser_open_url",
                "Open a URL in the local Playwright browser session.",
                {"url": {"type": "string"}, "wait_until": {"type": "string"}},
                ["url"],
            ),
            approval=True,
        )
    )

    def browser_snapshot(max_chars: int = 20000) -> dict[str, Any]:
        return _BROWSER.call("snapshot", lambda page: _snapshot(page, max_chars))

    browser_snapshot.__name__ = "browser_snapshot"
    tools.append(
        _attach(
            browser_snapshot,
            _schema(
                "browser_snapshot",
                "Return the current page text plus visible controls and selector hints.",
                {"max_chars": {"type": "integer"}},
                [],
            ),
            approval=True,
        )
    )

    def browser_get_text(max_chars: int = 20000) -> dict[str, Any]:
        def run(page):
            text = re.sub(
                r"\n{3,}", "\n\n", page.locator("body").inner_text(timeout=5000)
            )
            cap = _cap(max_chars)
            return {
                "url": page.url,
                "title": page.title(),
                "text": text[:cap],
                "truncated": len(text) > cap,
            }

        return _BROWSER.call("get_text", run)

    browser_get_text.__name__ = "browser_get_text"
    tools.append(
        _attach(
            browser_get_text,
            _schema(
                "browser_get_text",
                "Read visible text from the current browser page.",
                {"max_chars": {"type": "integer"}},
                [],
            ),
            approval=True,
        )
    )

    def browser_click(target: str) -> dict[str, Any]:
        return _BROWSER.call(
            "click",
            lambda page: (
                _target_locator(page, target).click(timeout=10000),
                {"ok": True, "url": page.url},
            )[1],
        )

    browser_click.__name__ = "browser_click"
    tools.append(
        _attach(
            browser_click,
            _schema(
                "browser_click",
                "Click a visible page element by CSS selector, text=label, role=button:Name, or text fallback. Requires approval.",
                {"target": {"type": "string"}},
                ["target"],
            ),
            approval=True,
        )
    )

    def browser_type(target: str, text: str, clear: bool = True) -> dict[str, Any]:
        def run(page):
            loc = _target_locator(page, target)
            if clear:
                loc.fill(text, timeout=10000)
            else:
                loc.type(text, timeout=10000)
            return {"ok": True, "url": page.url}

        return _BROWSER.call("type", run)

    browser_type.__name__ = "browser_type"
    tools.append(
        _attach(
            browser_type,
            _schema(
                "browser_type",
                "Fill or type into an input, textarea, or editable element. Requires approval.",
                {
                    "target": {"type": "string"},
                    "text": {"type": "string"},
                    "clear": {"type": "boolean"},
                },
                ["target", "text"],
            ),
            approval=True,
        )
    )

    def browser_select(target: str, value: str) -> dict[str, Any]:
        return _BROWSER.call(
            "select",
            lambda page: (
                _target_locator(page, target).select_option(value, timeout=10000),
                {"ok": True, "url": page.url},
            )[1],
        )

    browser_select.__name__ = "browser_select"
    tools.append(
        _attach(
            browser_select,
            _schema(
                "browser_select",
                "Select an option in a dropdown by selector and option value/label. Requires approval.",
                {"target": {"type": "string"}, "value": {"type": "string"}},
                ["target", "value"],
            ),
            approval=True,
        )
    )

    def browser_upload_file(target: str, path: str) -> dict[str, Any]:
        file_path = Path(path).expanduser().resolve()
        if not file_path.exists():
            return {"error": f"file not found: {file_path}"}
        return _BROWSER.call(
            "upload_file",
            lambda page: (
                _target_locator(page, target).set_input_files(
                    str(file_path), timeout=10000
                ),
                {"ok": True, "path": str(file_path)},
            )[1],
        )

    browser_upload_file.__name__ = "browser_upload_file"
    tools.append(
        _attach(
            browser_upload_file,
            _schema(
                "browser_upload_file",
                "Upload a local file through a file input. Requires approval.",
                {"target": {"type": "string"}, "path": {"type": "string"}},
                ["target", "path"],
            ),
            approval=True,
        )
    )

    def browser_wait(milliseconds: int = 1000, target: str = "") -> dict[str, Any]:
        def run(page):
            if target:
                _target_locator(page, target).wait_for(
                    timeout=max(1, int(milliseconds or 1000))
                )
            else:
                page.wait_for_timeout(max(1, min(int(milliseconds or 1000), 30000)))
            return {"ok": True, "url": page.url}

        return _BROWSER.call("wait", run)

    browser_wait.__name__ = "browser_wait"
    tools.append(
        _attach(
            browser_wait,
            _schema(
                "browser_wait",
                "Wait for a duration or for a target element to appear.",
                {"milliseconds": {"type": "integer"}, "target": {"type": "string"}},
                [],
            ),
            approval=True,
        )
    )

    def browser_screenshot(path: str = "") -> dict[str, Any]:
        def run(page):
            out = (
                Path(path).expanduser()
                if path
                else Path(tempfile.gettempdir()) / "coworker-browser-screenshot.png"
            )
            out = out.resolve()
            out.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(out), full_page=True)
            return {"ok": True, "path": str(out), "url": page.url}

        return _BROWSER.call("screenshot", run)

    browser_screenshot.__name__ = "browser_screenshot"
    tools.append(
        _attach(
            browser_screenshot,
            _schema(
                "browser_screenshot",
                "Save a full-page screenshot of the current browser page and return the local path.",
                {"path": {"type": "string"}},
                [],
            ),
            approval=True,
        )
    )

    def browser_close() -> dict[str, Any]:
        return browser_close_session()

    browser_close.__name__ = "browser_close"
    tools.append(
        _attach(
            browser_close,
            _schema(
                "browser_close",
                "Close the local Playwright browser session.",
                {},
                [],
            ),
            approval=True,
        )
    )

    return tools
