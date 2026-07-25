import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApprovalCard } from "./ApprovalCard";
import { InboxItemCard } from "./InboxItemCard";
import type { Item } from "../types";
import type { InboxItem } from "../api";

type ApprovalItem = Extract<Item, { kind: "approval" }>;

const RUN_TASK = { id: "task-1", title: "Weekly digest" };

const sendApproval = (extra: Partial<ApprovalItem> = {}): ApprovalItem => ({
  kind: "approval",
  name: "send_message",
  args: { target: "slack:T1/C1", text: "digest" },
  reason: "requires approval",
  category: "messaging",
  ...extra,
});

afterEach(cleanup);

describe("ApprovalCard — standing scoped approvals (§25)", () => {
  it("offers Allow every time only with BOTH a run context and an eligible target", () => {
    const onApprove = vi.fn();
    // Run context + standing target → offered (and it replaces the session-scoped button).
    render(
      <ApprovalCard
        item={sendApproval({ standingTarget: "slack:T1/C1" })}
        onApprove={onApprove}
        runTask={RUN_TASK}
      />,
    );
    fireEvent.click(screen.getByText("Allow every time"));
    expect(onApprove).toHaveBeenCalledWith("always_task");
    expect(screen.queryByText("Always allow")).toBeNull();
    cleanup();

    // No run context (a plain session) → never offered.
    render(
      <ApprovalCard item={sendApproval({ standingTarget: "slack:T1/C1" })} onApprove={vi.fn()} />,
    );
    expect(screen.queryByText("Allow every time")).toBeNull();
    cleanup();

    // Run context but no eligible target (e.g. run_shell) → never offered.
    render(
      <ApprovalCard
        item={sendApproval({ name: "run_shell", args: { command: "ls" }, standingTarget: undefined })}
        onApprove={vi.fn()}
        runTask={RUN_TASK}
      />,
    );
    expect(screen.queryByText("Allow every time")).toBeNull();
  });

  it("renders the create_scheduled_task consent proposal: reads disclose, writes grant", () => {
    render(
      <ApprovalCard
        item={sendApproval({
          name: "create_scheduled_task",
          args: {
            title: "Weekly digest",
            instructions: "post it",
            cron: "0 9 * * 1",
            permissions: [
              { tool: "send_message", target: "slack:T1/C1", access: "write" },
              { tool: "github_list_commits", target: "rohit/agent-platform", access: "read" },
            ],
          },
        })}
        onApprove={vi.fn()}
      />,
    );
    const grants = screen.getByTestId("approval-grants");
    expect(grants.textContent).toContain("slack:T1/C1");
    expect(grants.textContent).toContain("always allowed once you approve");
    expect(grants.textContent).toContain("rohit/agent-platform");
    expect(grants.textContent).toContain("read-only");
    // The raw permissions JSON must not also dump into the args line.
    expect(screen.queryByText(/permissions=/)).toBeNull();
  });
});

describe("ApprovalCard — §35 shapes", () => {
  it("routine file writes render as a compact row: humanized title, inline preview, Allow → once", () => {
    const onApprove = vi.fn();
    render(
      <ApprovalCard
        item={sendApproval({
          name: "write_file",
          args: { path: "src/fetch_data.py", content: "import json\nimport urllib\nx=1\ny=2\nz=3\ndone=1" },
          category: undefined,
        })}
        onApprove={onApprove}
      />,
    );
    const row = screen.getByTestId("approval-row");
    expect(row.textContent).toContain("Write ");
    expect(row.textContent).toContain("fetch_data.py");
    expect(screen.queryByText(/Permission required/i)).toBeNull();

    // Preview expands INLINE from the tool args (the file doesn't exist yet).
    expect(screen.queryByText(/import json/)).toBeNull();
    fireEvent.click(screen.getByText(/preview/));
    expect(screen.getByText(/import json/)).toBeTruthy();
    expect(screen.getByText("show all 6 lines")).toBeTruthy();

    fireEvent.click(screen.getByText("Allow"));
    expect(onApprove).toHaveBeenCalledWith("once");
  });

  it("send_file gets the full external card: destination title, file chip, leaves-the-Mac note", () => {
    render(
      <ApprovalCard
        item={sendApproval({
          name: "send_file",
          args: { target: "slack:T1/C9:1700.1", path: "out/report.pdf", comment: "here you go" },
        })}
        onApprove={vi.fn()}
      />,
    );
    expect(screen.getByText(/Send a file to/).textContent).toContain("C9");
    expect(screen.getByText(/leaves this Mac → Slack/)).toBeTruthy();
    expect(screen.getByText(/report\.pdf/)).toBeTruthy();
    expect(screen.getByText(/here you go/)).toBeTruthy();
    expect(screen.getByText("Allow once")).toBeTruthy();
  });

  it("long single-paragraph send_message text is clamped, expandable, and never a wall", () => {
    // Owner repro 2026-07-15: a one-paragraph Slack digest (no newlines) blew the card
    // up to full-transcript height — the preview clamped by LINES only.
    const digest = "aisuite last 24 hours of work: five PRs merged covering streaming, multimodal input, Slack improvements, human attribution, and formatting. ".repeat(8);
    render(<ApprovalCard item={sendApproval({ args: { target: "slack:T1/C1", text: digest } })} onApprove={vi.fn()} />);

    const prev = document.querySelector(".approval-prev") as HTMLElement;
    expect(prev.textContent!.length).toBeLessThan(500);
    fireEvent.click(screen.getByText("show the full message"));
    expect(document.querySelector(".approval-prev")!.textContent!.length).toBeGreaterThan(1000);
    expect(screen.getByText("show less")).toBeTruthy();
  });

  it("short send_message text keeps the inline quote (no preview box)", () => {
    render(<ApprovalCard item={sendApproval()} onApprove={vi.fn()} />);
    expect(screen.getByText(/“digest”/)).toBeTruthy();
    expect(document.querySelector(".approval-prev")).toBeNull();
  });

  it("run_shell titles with the model's description and previews the command", () => {
    render(
      <ApprovalCard
        item={sendApproval({
          name: "run_shell",
          args: { command: "python3 fetch.py > data.json", description: "Fetch semiconductor stock data" },
          category: undefined,
        })}
        onApprove={vi.fn()}
      />,
    );
    expect(screen.getByText(/Run a command — fetch semiconductor stock data/)).toBeTruthy();
    expect(screen.getByText(/python3 fetch\.py/)).toBeTruthy();
    expect(screen.getByText(/stays on this Mac/)).toBeTruthy();
    expect(screen.getByText("Always allow this command")).toBeTruthy();
  });
});

describe("InboxItemCard — Allow every time on parked run approvals", () => {
  const baseItem = (data?: Record<string, any>): InboxItem => ({
    id: "i1",
    session_id: "__run__r1",
    kind: "approval",
    title: "Run `send_message`?",
    body: "target: slack:T1/C1",
    state: "pending",
    resolution: null,
    inbox: "default",
    created_at: "",
    resolved_at: null,
    data,
  });

  it("shows the button only when the item carries the task binding + target", () => {
    const onResolve = vi.fn();
    render(
      <InboxItemCard
        item={baseItem({ task_id: "task-1", task_title: "Weekly digest", standing_target: "slack:T1/C1" })}
        onResolve={onResolve}
      />,
    );
    fireEvent.click(screen.getByText("Allow every time"));
    expect(onResolve).toHaveBeenCalledWith("i1", "always_task");
    cleanup();

    // A plain unattended-session approval (no task data) keeps Approve/Deny only.
    render(<InboxItemCard item={baseItem()} onResolve={vi.fn()} />);
    expect(screen.queryByText("Allow every time")).toBeNull();
    expect(screen.getByText("Approve")).toBeTruthy();
    expect(screen.getByText("Deny")).toBeTruthy();
  });

  it("parked approvals with tool data wear the §35 dress — same dialect as the live card", () => {
    const onResolve = vi.fn();
    render(
      <InboxItemCard
        item={baseItem({
          tool: "write_file",
          arguments: { path: "src/fetch_data.py", content: "import json\nx = 1" },
        })}
        onResolve={onResolve}
      />,
    );
    // Humanized title + preview from the args; the raw "Run `write_file`?" title is gone.
    expect(screen.getByText("fetch_data.py")).toBeTruthy();
    expect(screen.queryByText("Run `send_message`?")).toBeNull();
    expect(screen.getByText(/import json/)).toBeTruthy();
    expect(screen.getByText(/stays on this Mac/)).toBeTruthy();
    // §35 labels; resolution vocabulary unchanged (works on every approver path).
    fireEvent.click(screen.getByText("Allow once"));
    expect(onResolve).toHaveBeenCalledWith("i1", "allow");
    // Old rows without tool data keep the legacy treatment (covered above).
  });
});
