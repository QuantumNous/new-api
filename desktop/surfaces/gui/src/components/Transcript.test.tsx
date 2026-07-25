import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Transcript } from "./Transcript";
import { humanizeTool } from "../humanize";
import type { Item } from "../types";

afterEach(cleanup);

// §33 TurnGroup: the user-message → final-answer span is ONE disclosure; interior assistant
// text is narration INSIDE it, the trailing assistant text is the answer OUTSIDE it; steps
// are humanized one-liners; approvals fold into their tool's row as a chip.
const TURN: Item[] = [
  { kind: "user", text: "post the digest" },
  { kind: "assistant", text: "Checking what merged since yesterday." },
  { kind: "tool", id: "t1", name: "read_file", args: { path: "docs/runbook.md" }, status: "ok" },
  { kind: "approval", name: "send_message", args: { target: "slack:T1/C9" }, reason: "", resolved: "once" },
  { kind: "tool", id: "t2", name: "send_message", args: { target: "slack:T1/C9", text: "hi" }, status: "ok", preview: '{"ok": true}' },
  { kind: "assistant", text: "Posted to #all-openworker." },
];

describe("TurnGroup (Transcript §33)", () => {
  it("groups the whole turn; answer stays outside; narration and humanized steps inside", () => {
    const { container } = render(<Transcript items={TURN} onApprove={vi.fn()} />);

    // Collapsed at rest: "2 steps", NO approval count, and no step/narration content visible.
    expect(screen.getByText("2 steps")).toBeTruthy();
    expect(screen.queryByText(/approval/)).toBeNull();
    expect(screen.queryByTestId("turn-narration")).toBeNull();
    expect(screen.queryByText(/Sent a Slack message/)).toBeNull();

    // The final answer is a normal bubble OUTSIDE the disclosure, visible while collapsed.
    expect(screen.getByText("Posted to #all-openworker.")).toBeTruthy();

    // Expand → narration renders quiet inside; steps are English lines, not raw args;
    // the approval is a chip on the send_message row, not a separate box.
    fireEvent.click(container.querySelector("summary.stepgroup-head")!);
    expect(screen.getByTestId("turn-narration").textContent).toContain("Checking what merged");
    expect(screen.getByText("runbook.md")).toBeTruthy();
    expect(screen.getByText(/Sent a Slack message to/)).toBeTruthy();
    expect(screen.getByText("✓ approved")).toBeTruthy();
    expect(screen.queryByText("send_message approval")).toBeNull();

    // Raw stays one click away: the row's raw toggle reveals args + result verbatim.
    fireEvent.click(screen.getAllByText("raw")[1]);
    expect(container.textContent).toContain('{"ok": true}');
  });

  it("a running turn is labeled Running but starts COLLAPSED (§33 ref #3)", () => {
    const items: Item[] = [
      { kind: "assistant", text: "Looking at the repo." },
      { kind: "tool", id: "t1", name: "grep", args: { pattern: "TODO" }, status: "…" },
    ];
    const { container } = render(<Transcript items={items} onApprove={vi.fn()} />);
    expect(screen.getByText(/Running 1 step…/)).toBeTruthy();
    expect(screen.queryByTestId("turn-narration")).toBeNull(); // collapsed by default
    expect(screen.getByTestId("turn-live-line").textContent).toContain("Looking at the repo");
    fireEvent.click(container.querySelector("summary.stepgroup-head")!);
    expect(screen.getByTestId("step-running")).toBeTruthy();
  });

  it("declined approvals keep their own 'Wanted to' row and surface on the collapsed line", () => {
    const items: Item[] = [
      { kind: "tool", id: "t1", name: "read_file", args: { path: "a.md" }, status: "ok" },
      { kind: "approval", name: "run_shell", args: { command: "rm -rf build/" }, reason: "", resolved: "deny" },
    ];
    const { container } = render(<Transcript items={items} onApprove={vi.fn()} />);
    expect(screen.getByTestId("stepgroup-declined").textContent).toBe("1 declined");
    fireEvent.click(container.querySelector("summary.stepgroup-head")!);
    const ask = screen.getByTestId("turn-ask");
    expect(ask.textContent).toContain("Wanted to run");
    expect(ask.textContent).toContain("rm -rf build/");
    expect(ask.textContent).toContain("✕ declined");
  });

  it("assistant-only turns stay plain bubbles (no disclosure)", () => {
    const items: Item[] = [
      { kind: "user", text: "hi" },
      { kind: "assistant", text: "Hello there." },
    ];
    const { container } = render(<Transcript items={items} onApprove={vi.fn()} />);
    expect(container.querySelector("details.stepgroup")).toBeNull();
    expect(screen.getByText("Hello there.")).toBeTruthy();
  });
});

describe("live turns (§33 flicker fix)", () => {
  const LIVE: Item[] = [
    { kind: "user", text: "build the app" },
    { kind: "tool", id: "t1", name: "read_file", args: { path: "data.json" }, status: "ok" },
    { kind: "assistant", text: "Inspecting the fetched dataset next." },
  ];

  it("while running, trailing assistant text stays INSIDE the group — no answer bubble flash", () => {
    const { container } = render(<Transcript items={LIVE} onApprove={vi.fn()} running />);
    // No assistant bubble anywhere; the group starts COLLAPSED with the narration riding
    // the header as the live line (§33 ref #3 — expanding is opt-in).
    expect(container.querySelector(".bubble-assistant")).toBeNull();
    expect(screen.queryByTestId("turn-narration")).toBeNull();
    expect(screen.getByTestId("turn-live-line").textContent).toContain("Inspecting the fetched dataset");
    // Expanding shows it as the quiet line inside.
    fireEvent.click(container.querySelector("summary.stepgroup-head")!);
    expect(screen.getByTestId("turn-narration").textContent).toContain("Inspecting the fetched dataset");
    // Once the turn ends (running=false), the same trailing text IS the answer bubble.
    cleanup();
    const done = render(<Transcript items={LIVE} onApprove={vi.fn()} />);
    expect(done.container.querySelector(".bubble-assistant")?.textContent).toContain(
      "Inspecting the fetched dataset",
    );
  });

  it("quiet streamed text rides the collapsed header and the expanded body — never floats", () => {
    const { container } = render(
      <Transcript
        items={LIVE}
        onApprove={vi.fn()}
        running
        streamingText="The quote endpoint rate-limited, so I'm checking the historical pages."
      />,
    );
    // Collapsed: the STREAMING text wins the header live line (fresher than the last item).
    expect(screen.getByTestId("turn-live-line").textContent).toContain("quote endpoint rate-limited");
    expect(container.querySelector(".bubble-assistant")).toBeNull();
    // Expanded: it renders as the small quiet line under the steps.
    fireEvent.click(container.querySelector("summary.stepgroup-head")!);
    expect(screen.getByTestId("turn-live-stream").textContent).toContain("quote endpoint rate-limited");
  });

  it("a PENDING approval neither splits the turn nor promotes the narration", () => {
    const items: Item[] = [
      ...LIVE,
      { kind: "approval", name: "write_file", args: { path: "app.html" }, reason: "" }, // unresolved
    ];
    const { container } = render(<Transcript items={items} onApprove={vi.fn()} running />);
    expect(container.querySelectorAll("details.stepgroup")).toHaveLength(1);
    expect(container.querySelector(".bubble-assistant")).toBeNull();
  });

  it("a live run with NO tool activity is a plain streaming reply — bubbles as ever", () => {
    const items: Item[] = [
      { kind: "user", text: "hi" },
      { kind: "assistant", text: "Hello!" },
    ];
    const { container } = render(<Transcript items={items} onApprove={vi.fn()} running />);
    expect(container.querySelector("details.stepgroup")).toBeNull();
    expect(container.querySelector(".bubble-assistant")?.textContent).toContain("Hello!");
  });
});

describe("bubble hover affordances (FB-005)", () => {
  const TS = 1752969720; // unix seconds, as the server stamps them
  const ITEMS: Item[] = [
    { kind: "user", text: "post the digest", ts: TS },
    { kind: "assistant", text: "Done — posted to #all-openworker." }, // pre-stamp history: no ts
  ];

  it("copy button copies the bubble's raw text and flashes Copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<Transcript items={ITEMS} onApprove={vi.fn()} />);

    const copies = screen.getAllByTestId("bubble-copy");
    expect(copies).toHaveLength(2); // user + assistant bubbles both get one
    fireEvent.click(copies[0]);
    expect(writeText).toHaveBeenCalledWith("post the digest");
    // "Copied" lands only after the clipboard write RESOLVES (a rejected write must
    // not claim success), hence the await.
    await waitFor(() => expect(copies[0].textContent).toBe("Copied"));
    fireEvent.click(copies[1]);
    expect(writeText).toHaveBeenCalledWith("Done — posted to #all-openworker.");
  });

  it("timestamp renders only when the item carries ts; full date rides the title", () => {
    render(<Transcript items={ITEMS} onApprove={vi.fn()} />);

    const stamps = screen.getAllByTestId("bubble-ts");
    expect(stamps).toHaveLength(1); // the ts-less assistant bubble shows none
    const when = new Date(TS * 1000);
    expect(stamps[0].textContent).toBe(when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    expect(stamps[0].getAttribute("title")).toBe(when.toLocaleString());
  });
});

describe("humanizeTool", () => {
  it("prefers run_shell's model-written description and keeps the command as the object", () => {
    const line = humanizeTool("run_shell", { command: "git log --since=yesterday", description: "List yesterday's merges" });
    expect(line.pre).toBe("Ran ");
    expect(line.obj).toBe("git log --since=yesterday");
    expect(line.post).toContain("list yesterday's merges");
  });

  it("falls back to 'Used <tool> — <short args>' for unknown tools", () => {
    const line = humanizeTool("gmail_search_messages", { query: "from:ci" });
    expect(line.pre).toBe("Used gmail_search_messages");
    expect(line.post).toContain("query=from:ci");
  });

  it("summarizes todo_write by its single item and status", () => {
    const line = humanizeTool("todo_write", { todos: [{ content: "Post the digest", status: "in_progress" }] });
    expect(line.pre).toBe("Updated the plan — ");
    expect(line.obj).toContain("Post the digest");
    expect(line.post).toBe(" → in progress");
  });

  it("still renders pre-rename todo_write histories (legacy `items` key)", () => {
    const line = humanizeTool("todo_write", { items: [{ content: "Old plan", status: "pending" }] });
    expect(line.obj).toContain("Old plan");
  });
});
